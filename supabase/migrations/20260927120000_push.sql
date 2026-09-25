-- Notifiche push: iscrizioni per dispositivo, registro degli invii, e il giro ogni minuto.

-- ——— Iscrizioni ——————————————————————————————————————————————————————————————
-- Una riga per browser/dispositivo (endpoint unico). Le chiavi servono a cifrare il messaggio per quel browser.

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "ognuno vede le proprie" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.push_subscriptions from authenticated;

-- Salva l'iscrizione di questo dispositivo. Se lo stesso browser era di un altro utente (cambio account), passa a questo.
create function public.save_push_subscription(endpoint text, p256dh text, auth text, user_agent text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_real_user() then raise exception 'Serve un utente con email' using errcode = '42501'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
    values (save_push_subscription.endpoint, auth.uid(), save_push_subscription.p256dh, save_push_subscription.auth, save_push_subscription.user_agent)
  on conflict on constraint push_subscriptions_pkey do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

create function public.delete_push_subscription(endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions p where p.endpoint = delete_push_subscription.endpoint and p.user_id = auth.uid();
$$;

revoke execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text) to authenticated;

-- ——— Registro degli invii ————————————————————————————————————————————————————
-- Una riga per occorrenza notificata: se il giro si ripete (o due giri si sovrappongono) non parte due volte.
-- Solo la funzione (service role) lo tocca: nessuna policy.

create table public.notification_log (
  kind text not null check (kind in ('reminder', 'deadline')),
  item_id uuid not null,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, item_id, key)
);
alter table public.notification_log enable row level security;

-- ——— Il giro ogni minuto ————————————————————————————————————————————————————
-- pg_cron chiama la Edge Function `notify` con pg_net. Indirizzo e segreto stanno nel Vault, non nel repo:
--   select vault.create_secret('https://<progetto>.supabase.co/functions/v1/notify', 'notify_url');
--   select vault.create_secret('<stesso valore di NOTIFY_SECRET>', 'notify_secret');
-- In locale li crea supabase/seed.sql. Senza segreti il job non chiama niente.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function public.call_notify() returns void
language plpgsql security definer set search_path = '' as $$
declare
  url text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret');
begin
  if url is null or secret is null then return; end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke execute on function public.call_notify() from public, anon, authenticated;

select cron.schedule('notify', '* * * * *', 'select public.call_notify()');

-- Pulizia: le righe tolte dalla lista della spesa servono alla sincronizzazione solo per un po'.
-- Un dispositivo offline per più di 30 giorni riparte dalla lista attuale (primo download completo).
select cron.schedule('shopping-tombstones', '17 3 * * *',
  $$delete from public.shopping_items where deleted_at < now() - interval '30 days'$$);
select cron.schedule('notification-log', '23 3 * * *',
  $$delete from public.notification_log where sent_at < now() - interval '400 days'$$);
