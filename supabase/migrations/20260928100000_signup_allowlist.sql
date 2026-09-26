-- Solo su invito: un account nuovo con email si crea solo se l'indirizzo è in questo elenco.
-- Supabase chiama public.hook_before_user_created prima di creare ogni utente (config.toml, [auth.hook.before_user_created]).
-- Gli anonimi (la TV) passano sempre: senza abbinamento, fatto da un membro, non vedono niente.
-- Per ora l'elenco si riempie a mano (Table Editor o SQL); gli inviti per email lo faranno da soli, più avanti.

create table public.signup_allowlist (
  email text primary key check (email = lower(btrim(email)) and email like '%@%'),
  note text,
  added_at timestamptz not null default now()
);
-- Nessuna policy: dall'app non si legge né si scrive. Solo dashboard, SQL e l'hook qui sotto.
alter table public.signup_allowlist enable row level security;

create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  address text := lower(btrim(event -> 'user' ->> 'email'));
begin
  if coalesce((event -> 'user' ->> 'is_anonymous')::boolean, false) then
    return '{}'::jsonb;
  end if;
  if address <> '' and exists (select 1 from public.signup_allowlist a where a.email = address) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Questo indirizzo non è stato invitato.'
  ));
end;
$$;

-- La chiama solo il servizio di autenticazione.
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
