-- Solo sviluppo locale (supabase db reset). In produzione i segreti si creano a mano, vedi la migrazione push.
-- Il database raggiunge le Edge Functions attraverso il gateway, nella rete Docker di Supabase.
select vault.create_secret('http://supabase_kong_homeboard:8000/functions/v1/notify', 'notify_url');
select vault.create_secret('local-dev-notify-secret', 'notify_secret');
