-- Roby diventa un assistente vocale: il Raspberry non solo legge, ma scrive quello che gli si chiede a voce.
--
-- Chi può fare cosa, da qui in poi:
--   membro      = legge e scrive tutto della casa, gestisce membri e impostazioni.
--   dispositivo = il Pi (utente anonimo abbinato): legge, e scrive solo i dati di tutti i giorni
--                 (spesa, promemoria, scadenze, note, timer). Niente membri, casa, inviti, push.
-- In più: timer (li tiene il Pi, la PWA li guarda), note per il "second brain", frasi non capite.

-- ——— Il dispositivo scrive ———————————————————————————————————————————————————

create function public.is_device(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.devices
    where household_id = hid and user_id = (select auth.uid())
  );
$$;

-- Chi scrive i dati di tutti i giorni: i membri e i dispositivi della casa (oggi coincide con can_read,
-- ma sono due domande diverse: se un giorno un dispositivo sarà solo uno schermo, cambia solo questa).
create function public.can_write(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member(hid) or public.is_device(hid);
$$;

revoke execute on function public.is_device(uuid), public.can_write(uuid) from public, anon;
grant execute on function public.is_device(uuid), public.can_write(uuid) to authenticated;

alter policy "i membri aggiungono" on public.shopping_items rename to "membri e dispositivi aggiungono";
alter policy "membri e dispositivi aggiungono" on public.shopping_items with check (public.can_write(household_id));
alter policy "i membri modificano" on public.shopping_items rename to "membri e dispositivi modificano";
alter policy "membri e dispositivi modificano" on public.shopping_items
  using (public.can_write(household_id)) with check (public.can_write(household_id));

-- I suggerimenti servono anche al Pi, per indovinare il reparto di "aggiungi il latte".
alter policy "i membri leggono" on public.shopping_item_stats rename to "leggono membri e dispositivi";
alter policy "leggono membri e dispositivi" on public.shopping_item_stats using (public.can_read(household_id));

alter policy "i membri aggiungono" on public.reminders rename to "membri e dispositivi aggiungono";
alter policy "membri e dispositivi aggiungono" on public.reminders with check (public.can_write(household_id));
alter policy "i membri modificano" on public.reminders rename to "membri e dispositivi modificano";
alter policy "membri e dispositivi modificano" on public.reminders
  using (public.can_write(household_id)) with check (public.can_write(household_id));

-- Scadenze: "segna che ho pagato la bolletta" passa da complete_deadline (security invoker), che chiude
-- e rinnova: servono insert e update.
alter policy "i membri aggiungono" on public.deadlines rename to "membri e dispositivi aggiungono";
alter policy "membri e dispositivi aggiungono" on public.deadlines with check (public.can_write(household_id));
alter policy "i membri modificano" on public.deadlines rename to "membri e dispositivi modificano";
alter policy "membri e dispositivi modificano" on public.deadlines
  using (public.can_write(household_id)) with check (public.can_write(household_id));

-- ——— Timer ————————————————————————————————————————————————————————————————————
-- Vivono sul Pi (funzionano anche senza rete): questa è solo la vetrina per la PWA. Il Pi scrive la riga
-- quando parte il timer, la aggiorna quando suona e la cancella quando lo si ferma. L'id lo genera il Pi.

create table public.timers (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  label text check (length(btrim(label)) between 1 and 40),
  duration_s integer not null check (duration_s between 1 and 86400),
  ends_at timestamptz not null,
  status text not null default 'running' check (status in ('running', 'ringing')),
  created_by uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.timers (household_id);
create trigger touch before insert or update on public.timers for each row execute function public.touch_row();

alter table public.timers enable row level security;
create policy "leggono membri e dispositivi" on public.timers
  for select to authenticated using (public.can_read(household_id));
create policy "solo il dispositivo li crea" on public.timers
  for insert to authenticated with check (public.is_device(household_id));
create policy "solo il dispositivo li aggiorna" on public.timers
  for update to authenticated using (public.is_device(household_id)) with check (public.is_device(household_id));
create policy "solo il dispositivo li ferma" on public.timers
  for delete to authenticated using (public.is_device(household_id));
revoke update on public.timers from authenticated;
grant update (label, ends_at, status) on public.timers to authenticated;

-- ——— Note (second brain) ——————————————————————————————————————————————————————
-- "Ricorda che la chiave di scorta è da mia madre". Si ritrovano per significato (embedding, calcolato in
-- locale sul Pi con un modello multilingue da 384 dimensioni) o, finché l'embedding manca, per parole.

create extension if not exists vector with schema extensions;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  source text not null default 'pwa' check (source in ('voce', 'pwa', 'share')),
  embedding extensions.vector(384),
  tsv tsvector generated always as (to_tsvector('italian', body)) stored,
  created_by uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.notes (household_id, updated_at);
create index on public.notes using gin (tsv);
create index on public.notes using hnsw (embedding extensions.vector_cosine_ops);
create trigger touch before insert or update on public.notes for each row execute function public.touch_row();

-- Se cambia il testo, il vecchio embedding non vale più: lo ricalcola il Pi.
create function public.reset_note_embedding() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.body is distinct from old.body and new.embedding::text is not distinct from old.embedding::text then
    new.embedding := null;
  end if;
  return new;
end;
$$;
create trigger reset_embedding before update on public.notes
  for each row execute function public.reset_note_embedding();
revoke execute on function public.reset_note_embedding() from public, anon, authenticated;

alter table public.notes enable row level security;
create policy "leggono membri e dispositivi" on public.notes
  for select to authenticated using (public.can_read(household_id));
create policy "membri e dispositivi aggiungono" on public.notes
  for insert to authenticated with check (public.can_write(household_id));
create policy "membri e dispositivi modificano" on public.notes
  for update to authenticated using (public.can_write(household_id)) with check (public.can_write(household_id));
revoke delete, update on public.notes from authenticated;
grant update (body, embedding, deleted_at) on public.notes to authenticated;

-- ——— Frasi non capite ————————————————————————————————————————————————————————
-- Per migliorare le regole dell'interprete. Si scrivono e basta; le leggono (e le cancellano) i membri.

create table public.unparsed_log (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households on delete cascade,
  text text not null check (length(text) between 1 and 500),
  source text not null check (source in ('voce', 'pwa')),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on public.unparsed_log (household_id, created_at);

alter table public.unparsed_log enable row level security;
create policy "membri e dispositivi registrano" on public.unparsed_log
  for insert to authenticated with check (public.can_write(household_id));
create policy "i membri leggono" on public.unparsed_log
  for select to authenticated using (public.is_member(household_id));
create policy "i membri cancellano" on public.unparsed_log
  for delete to authenticated using (public.is_member(household_id));
revoke update on public.unparsed_log from authenticated;

alter publication supabase_realtime add table public.timers, public.notes;
