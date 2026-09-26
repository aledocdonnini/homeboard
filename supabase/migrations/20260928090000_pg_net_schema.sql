-- pg_net fuori dallo schema public (avviso "extension_in_public" degli advisors di Supabase).
-- Le sue funzioni (net.http_post, usata da call_notify) stanno comunque nello schema `net`: niente da cambiare altrove.
-- Si perde solo il registro delle risposte HTTP già ricevute (net._http_response).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
