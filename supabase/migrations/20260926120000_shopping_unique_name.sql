-- Offline, due telefoni possono aggiungere la stessa cosa: il server ne tiene una sola.
-- Il secondo inserimento fallisce con 23505 su questo indice e il client lo scarta (vedi features/shopping/sync.ts).
-- Solo sulle righe vive: una cosa tolta dalla lista si può aggiungere di nuovo.
create unique index shopping_items_live_name
  on public.shopping_items (household_id, lower(btrim(name)))
  where deleted_at is null;
