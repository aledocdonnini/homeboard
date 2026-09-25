-- Promemoria e scadenze. Le ricorrenze si calcolano in TypeScript (supabase/functions/_shared/recurrence.ts),
-- lo stesso codice nella PWA e nella funzione delle notifiche; qui si controlla solo che siano ben formate.
-- Come per la spesa: i membri scrivono, la TV legge, niente delete (deleted_at), realtime.

create function public.valid_recurrence(r jsonb, freqs text[]) returns boolean
language sql immutable set search_path = '' as $$
  select r is null or (
    jsonb_typeof(r) = 'object'
    and r ->> 'freq' = any (freqs)
    and jsonb_typeof(r -> 'interval') = 'number'
    and (r ->> 'interval')::int between 1 and 99
    and (not r ? 'byWeekday' or (
      jsonb_typeof(r -> 'byWeekday') = 'array'
      and not exists (select 1 from jsonb_array_elements(r -> 'byWeekday') d where jsonb_typeof(d) <> 'number' or d::int not between 0 and 6)
    ))
  );
$$;

-- ——— Promemoria ——————————————————————————————————————————————————————————————
-- Data e ora "da orologio" nel fuso della casa (households.timezone). next_at è il prossimo istante da
-- notificare: lo calcola il client quando salva e la funzione delle notifiche dopo ogni invio.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  note text check (length(note) <= 500),
  start_date date not null,
  at_time time not null,
  recurrence jsonb check (public.valid_recurrence(recurrence, array['day', 'week', 'month', 'year'])),
  next_at timestamptz,
  created_by uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.reminders (household_id);
create index on public.reminders (next_at) where deleted_at is null;

-- ——— Scadenze ————————————————————————————————————————————————————————————————
-- start_date è la prima scadenza (l'àncora delle ricorrenze: niente deriva a fine mese), due_date quella
-- corrente. "Fatta" chiude la riga (done_at) e, se ricorre, ne crea una nuova con la scadenza successiva.

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  category text not null default 'altro'
    check (category in ('bollette', 'auto', 'assicurazioni', 'casa', 'abbonamenti', 'salute', 'altro')),
  note text check (length(note) <= 500),
  start_date date not null,
  due_date date not null check (due_date >= start_date),
  recurrence jsonb check (public.valid_recurrence(recurrence, array['month', 'year'])),
  -- Quanti giorni prima avvisare: 0 = il giorno stesso.
  notify_days int[] not null default '{7,0}'
    check (cardinality(notify_days) <= 6 and 0 <= all (notify_days) and 366 >= all (notify_days)),
  done_at timestamptz,
  created_by uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.deadlines (household_id, due_date) where deleted_at is null and done_at is null;

-- ——— Regole comuni ————————————————————————————————————————————————————————————

create trigger touch before insert or update on public.reminders for each row execute function public.touch_row();
create trigger touch before insert or update on public.deadlines for each row execute function public.touch_row();

alter table public.reminders enable row level security;
alter table public.deadlines enable row level security;

create policy "leggono membri e dispositivi" on public.reminders for select to authenticated using (public.can_read(household_id));
create policy "i membri aggiungono" on public.reminders for insert to authenticated with check (public.is_member(household_id));
create policy "i membri modificano" on public.reminders for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy "leggono membri e dispositivi" on public.deadlines for select to authenticated using (public.can_read(household_id));
create policy "i membri aggiungono" on public.deadlines for insert to authenticated with check (public.is_member(household_id));
create policy "i membri modificano" on public.deadlines for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

revoke delete, update on public.reminders, public.deadlines from authenticated;
grant update (title, note, start_date, at_time, recurrence, next_at, deleted_at) on public.reminders to authenticated;
grant update (title, category, note, start_date, due_date, recurrence, notify_days, done_at, deleted_at) on public.deadlines to authenticated;

-- "Fatta": chiude la scadenza e, se ricorre, apre la successiva, in una transazione sola.
-- La data successiva la calcola il client con recurrence.ts; qui si controlla che abbia senso.
-- security invoker: valgono le policy di chi la chiama (solo i membri).
create function public.complete_deadline(deadline uuid, next_due date default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  d public.deadlines;
  new_id uuid;
begin
  update public.deadlines set done_at = now()
    where id = deadline and done_at is null and deleted_at is null
    returning * into d;
  if d.id is null then raise exception 'Scadenza non trovata o già fatta' using errcode = 'P0002'; end if;
  if next_due is null then return null; end if;
  if d.recurrence is null then raise exception 'Questa scadenza non si ripete' using errcode = '22023'; end if;
  if next_due <= d.due_date then raise exception 'La prossima scadenza deve venire dopo %', d.due_date using errcode = '22023'; end if;
  insert into public.deadlines (household_id, title, category, note, start_date, due_date, recurrence, notify_days)
    values (d.household_id, d.title, d.category, d.note, d.start_date, next_due, d.recurrence, d.notify_days)
    returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.complete_deadline(uuid, date) from public, anon;
grant execute on function public.complete_deadline(uuid, date) to authenticated;

alter publication supabase_realtime add table public.reminders, public.deadlines;
