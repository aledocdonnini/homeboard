-- La casa la crea solo chi è autorizzato; gli altri li aggiunge il proprietario, per email.
--
-- signup_allowlist diventa anche l'elenco di "chi va in quale casa":
--   household_id          la casa in cui entra quella persona (in automatico, appena ha un account)
--   can_create_household  può creare case (si imposta a mano, per ora solo per te)

alter table public.signup_allowlist
  add column household_id uuid references public.households on delete cascade,
  add column can_create_household boolean not null default false;

create function public.can_create_household() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_real_user() and exists (
    select 1 from public.signup_allowlist a
    where a.email = lower(auth.jwt() ->> 'email') and a.can_create_household
  );
$$;
revoke execute on function public.can_create_household() from public, anon;
grant execute on function public.can_create_household() to authenticated;

-- Stessa funzione di prima, con in più il controllo del permesso.
create or replace function public.create_household(name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if not public.can_create_household() then
    raise exception 'Solo chi è autorizzato può creare una casa' using errcode = '42501';
  end if;
  insert into public.households (name) values (btrim(create_household.name)) returning id into hid;
  insert into public.household_members (household_id, user_id, role, display_name)
    values (hid, auth.uid(), 'owner', public.default_display_name());
  return hid;
end;
$$;

-- Entra nella casa dell'elenco: chiamata dai due trigger qui sotto.
create function public.join_listed_household(uid uuid, address text) returns void
language sql security definer set search_path = '' as $$
  insert into public.household_members (household_id, user_id, display_name)
    select a.household_id, uid, left(split_part(address, '@', 1), 40)
    from public.signup_allowlist a
    where a.email = lower(btrim(address)) and a.household_id is not null
  on conflict do nothing;
$$;
revoke execute on function public.join_listed_household(uuid, text) from public, anon, authenticated;

-- Chi si registra per la prima volta entra subito nella sua casa.
create function public.on_user_created_join() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null then perform public.join_listed_household(new.id, new.email); end if;
  return null;
end;
$$;
create trigger join_listed_household after insert on auth.users
  for each row execute function public.on_user_created_join();

-- Chi ha già un account e viene aggiunto dopo: entra appena il proprietario lo aggiunge.
create function public.on_allowlist_join() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.household_id is not null then
    perform public.join_listed_household(u.id, u.email) from auth.users u where lower(u.email) = new.email;
  end if;
  return null;
end;
$$;
create trigger join_listed_household after insert or update of household_id on public.signup_allowlist
  for each row execute function public.on_allowlist_join();

revoke execute on function public.on_user_created_join(), public.on_allowlist_join() from public, anon, authenticated;

-- Il proprietario aggiunge una persona alla casa. 'aggiunta' se aveva già un account, 'in_attesa' se entrerà al primo accesso.
create function public.add_member(household uuid, email text) returns text
language plpgsql security definer set search_path = '' as $$
declare address text := lower(btrim(add_member.email));
begin
  if not public.is_owner(household) then
    raise exception 'Solo chi ha creato la casa può aggiungere persone' using errcode = '42501';
  end if;
  if address not like '%_@_%' then raise exception 'Email non valida' using errcode = '22023'; end if;
  insert into public.signup_allowlist (email, household_id, note) values (address, household, 'aggiunta dalla casa')
    on conflict on constraint signup_allowlist_pkey do update set household_id = excluded.household_id;
  return case when exists (select 1 from auth.users u where lower(u.email) = address) then 'aggiunta' else 'in_attesa' end;
end;
$$;
revoke execute on function public.add_member(uuid, text) from public, anon;
grant execute on function public.add_member(uuid, text) to authenticated;
