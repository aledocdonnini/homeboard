-- Solo sviluppo locale (supabase db reset). In produzione i segreti si creano a mano, vedi la migrazione push.
-- Il database raggiunge le Edge Functions attraverso il gateway, nella rete Docker di Supabase.
select vault.create_secret('http://supabase_kong_homeboard:8000/functions/v1/notify', 'notify_url');
select vault.create_secret('local-dev-notify-secret', 'notify_secret');

-- Email ammesse in locale (i nostri utenti di prova).
insert into public.signup_allowlist (email, note) values
  ('anna@test.it', 'prova'), ('bruno@test.it', 'prova'), ('carla@test.it', 'prova'), ('dario@test.it', 'prova')
on conflict do nothing;
