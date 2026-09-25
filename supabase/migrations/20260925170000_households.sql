-- Case, membri, inviti e dispositivi (la TV).
--
-- Chi può fare cosa:
--   membro     = utente con email, in household_members: legge e scrive i dati della casa.
--   dispositivo = utente anonimo Supabase abbinato a una casa (la TV): legge soltanto.
-- Le scritture che attraversano i confini (creare una casa, accettare un invito, abbinare la TV)
-- passano da funzioni security definer che fanno i controlli; le tabelle non hanno policy di insert.

-- ——— Tabelle ————————————————————————————————————————————————————————————————

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  timezone text not null default 'Europe/Rome',
  -- Orari della TV: fra night_start e night_end va in onda "fine delle trasmissioni".
  night_start time not null default '23:30',
  night_end time not null default '07:00',
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text check (length(display_name) <= 40),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

-- Link di invito: uso singolo, scade dopo 7 giorni. Il token è un uuid casuale (122 bit).
create table public.household_invites (
  token uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index on public.household_invites (household_id);

-- Un dispositivo è un utente anonimo (la sessione resta nel browser della TV) legato a una casa.
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null unique references auth.users on delete cascade,
  name text not null default 'TV' check (length(btrim(name)) between 1 and 40),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.devices (household_id);

-- Codice mostrato sulla TV da abbinare dalla PWA. Solo tramite funzioni: nessuna policy.
create table public.device_pairings (
  code text primary key,
  user_id uuid not null unique references auth.users on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes'
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.devices enable row level security;
alter table public.device_pairings enable row level security;

-- ——— Helper per le policy ———————————————————————————————————————————————————
-- security definer: leggono household_members e devices senza passare dalle loro policy (niente ricorsione).

create function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = (select auth.uid())
  );
$$;

create function public.can_read(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member(hid) or exists (
    select 1 from public.devices
    where household_id = hid and user_id = (select auth.uid())
  );
$$;

create function public.is_owner(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- Gli utenti anonimi (le TV) non possono diventare membri.
create function public.is_real_user() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- ——— Policy —————————————————————————————————————————————————————————————————

create policy "leggono membri e dispositivi" on public.households
  for select to authenticated using (public.can_read(id));
create policy "i membri modificano" on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy "il proprietario elimina" on public.households
  for delete to authenticated using (public.is_owner(id));

create policy "i membri si vedono fra loro" on public.household_members
  for select to authenticated using (public.is_member(household_id));
create policy "ognuno modifica il proprio profilo" on public.household_members
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Si esce da soli; il proprietario può togliere gli altri.
create policy "uscire o togliere un membro" on public.household_members
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_owner(household_id));
-- Il ruolo non si cambia da client: update solo su display_name.
revoke update on public.household_members from authenticated;
grant update (display_name) on public.household_members to authenticated;

create policy "i membri vedono gli inviti" on public.household_invites
  for select to authenticated using (public.is_member(household_id));
create policy "i membri creano inviti" on public.household_invites
  for insert to authenticated with check (public.is_member(household_id) and created_by = (select auth.uid()));
create policy "i membri revocano inviti" on public.household_invites
  for delete to authenticated using (public.is_member(household_id));
revoke update on public.household_invites from authenticated;

-- La TV vede la propria riga (per sapere di che casa è); i membri vedono e revocano le TV della casa.
create policy "membri e il dispositivo stesso" on public.devices
  for select to authenticated using (user_id = (select auth.uid()) or public.is_member(household_id));
create policy "i membri rinominano" on public.devices
  for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "i membri revocano" on public.devices
  for delete to authenticated using (public.is_member(household_id));
revoke update on public.devices from authenticated;
grant update (name) on public.devices to authenticated;

-- ——— Funzioni (RPC) —————————————————————————————————————————————————————————

-- Nome visibile agli altri membri: la parte dell'email prima della @, modificabile poi.
create function public.default_display_name() returns text
language sql stable set search_path = '' as $$
  select left(split_part(auth.jwt() ->> 'email', '@', 1), 40);
$$;
revoke execute on function public.default_display_name() from public, anon;

-- Crea la casa e ne fa proprietario chi la crea, in un colpo solo.
create function public.create_household(name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if not public.is_real_user() then raise exception 'Serve un utente con email' using errcode = '42501'; end if;
  insert into public.households (name) values (btrim(create_household.name)) returning id into hid;
  insert into public.household_members (household_id, user_id, role, display_name)
    values (hid, auth.uid(), 'owner', public.default_display_name());
  return hid;
end;
$$;

-- Accetta un invito: chi lo usa entra come membro, l'invito viene consumato.
create function public.accept_invite(invite uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if not public.is_real_user() then raise exception 'Serve un utente con email' using errcode = '42501'; end if;
  delete from public.household_invites
    where token = invite and expires_at > now()
    returning household_id into hid;
  if hid is null then raise exception 'Invito non valido o scaduto' using errcode = 'P0002'; end if;
  insert into public.household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), public.default_display_name())
    on conflict do nothing;
  return hid;
end;
$$;

-- La TV chiede un codice da mostrare. Un nuovo codice sostituisce il precedente.
-- Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L).
create function public.start_pairing() returns text
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  if auth.uid() is null then raise exception 'Serve una sessione' using errcode = '42501'; end if;
  delete from public.device_pairings where user_id = auth.uid() or expires_at < now();
  loop
    select string_agg(substr(alphabet, 1 + get_byte(b, i) % length(alphabet), 1), '')
      into c
      from extensions.gen_random_bytes(6) as b, generate_series(0, 5) as i;
    begin
      insert into public.device_pairings (code, user_id) values (c, auth.uid());
      return c;
    exception when unique_violation then -- codice già in uso: ne genero un altro
    end;
  end loop;
end;
$$;

-- Un membro abbina la TV che mostra il codice alla propria casa. Il codice si brucia.
-- Se la TV era già abbinata a un'altra casa, passa a questa.
create function public.claim_pairing(code text, household uuid, name text default 'TV') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tv uuid;
  did uuid;
begin
  if not public.is_member(household) then raise exception 'Non sei membro di questa casa' using errcode = '42501'; end if;
  delete from public.device_pairings p
    where p.code = upper(btrim(claim_pairing.code)) and p.expires_at > now()
    returning p.user_id into tv;
  if tv is null then raise exception 'Codice non valido o scaduto' using errcode = 'P0002'; end if;
  insert into public.devices (household_id, user_id, name) values (household, tv, claim_pairing.name)
    on conflict (user_id) do update set household_id = excluded.household_id, name = excluded.name, last_seen_at = null
    returning id into did;
  return did;
end;
$$;

-- Battito della TV: aggiorna last_seen_at della propria riga.
create function public.device_heartbeat() returns void
language sql security definer set search_path = '' as $$
  update public.devices set last_seen_at = now() where user_id = auth.uid();
$$;

-- Le funzioni sono eseguibili solo da utenti autenticati (anche anonimi: i controlli sono dentro).
revoke execute on function
  public.is_member(uuid), public.can_read(uuid), public.is_owner(uuid), public.is_real_user(),
  public.create_household(text), public.accept_invite(uuid),
  public.start_pairing(), public.claim_pairing(text, uuid, text), public.device_heartbeat()
  from public, anon;
grant execute on function
  public.is_member(uuid), public.can_read(uuid), public.is_owner(uuid), public.is_real_user(),
  public.create_household(text), public.accept_invite(uuid),
  public.start_pairing(), public.claim_pairing(text, uuid, text), public.device_heartbeat()
  to authenticated;
