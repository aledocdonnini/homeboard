-- Solo sviluppo locale (supabase db reset). In produzione i segreti si creano a mano, vedi la migrazione push.
-- Il database raggiunge le Edge Functions attraverso il gateway, nella rete Docker di Supabase.
select vault.create_secret('http://supabase_kong_homeboard:8000/functions/v1/notify', 'notify_url');
select vault.create_secret('local-dev-notify-secret', 'notify_secret');

-- Email ammesse in locale (i nostri utenti di prova). Anna può creare case, come te in produzione.
insert into public.signup_allowlist (email, note, can_create_household) values
  ('anna@test.it', 'prova', true), ('bruno@test.it', 'prova', false), ('carla@test.it', 'prova', false), ('dario@test.it', 'prova', false)
on conflict (email) do update set can_create_household = excluded.can_create_household;
