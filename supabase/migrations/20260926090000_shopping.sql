-- Lista della spesa condivisa della casa, più le statistiche d'uso che alimentano i suggerimenti.
--
-- Pensata per la sincronizzazione offline (fase 4):
--   - l'id lo genera il client, quindi un invio ripetuto non crea doppioni;
--   - updated_at lo scrive il server (trigger), ed è l'orologio unico per risolvere i conflitti;
--   - niente delete: si cancella con deleted_at (tombstone), così la cancellazione arriva anche a chi era offline.

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  category text not null default 'altro',
  checked boolean not null default false,
  position double precision not null default 0,
  created_by uuid default auth.uid() references auth.users on delete set null,
  updated_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.shopping_items (household_id, updated_at);

create function public.touch_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger touch before insert or update on public.shopping_items
  for each row execute function public.touch_row();

alter table public.shopping_items enable row level security;
create policy "leggono membri e dispositivi" on public.shopping_items
  for select to authenticated using (public.can_read(household_id));
create policy "i membri aggiungono" on public.shopping_items
  for insert to authenticated with check (public.is_member(household_id));
create policy "i membri modificano" on public.shopping_items
  for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
-- Nessuna policy di delete: si cancella con deleted_at. La casa e gli id non si spostano.
revoke delete on public.shopping_items from authenticated;
revoke update on public.shopping_items from authenticated;
grant update (name, category, checked, position, deleted_at) on public.shopping_items to authenticated;

-- ——— Suggerimenti ———————————————————————————————————————————————————————————
-- Una riga per nome (normalizzato) per casa: quante volte è stato aggiunto, l'ultima volta e con che reparto.

create table public.shopping_item_stats (
  household_id uuid not null references public.households on delete cascade,
  name_norm text not null,
  name text not null,
  category text not null,
  uses integer not null default 1,
  last_used timestamptz not null default now(),
  primary key (household_id, name_norm)
);

alter table public.shopping_item_stats enable row level security;
create policy "i membri leggono" on public.shopping_item_stats
  for select to authenticated using (public.is_member(household_id));
-- Scritta solo dal trigger; i membri possono dimenticare un suggerimento.
create policy "i membri dimenticano" on public.shopping_item_stats
  for delete to authenticated using (public.is_member(household_id));

create function public.count_shopping_use() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.shopping_item_stats as s (household_id, name_norm, name, category)
    values (new.household_id, lower(btrim(new.name)), btrim(new.name), new.category)
  on conflict (household_id, name_norm) do update
    set uses = s.uses + 1, last_used = now(), name = excluded.name, category = excluded.category;
  return null;
end;
$$;
create trigger count_use after insert on public.shopping_items
  for each row execute function public.count_shopping_use();
-- Rimettere in lista una cosa già spuntata conta come un nuovo uso.
create trigger count_reuse after update of checked on public.shopping_items
  for each row when (old.checked and not new.checked and new.deleted_at is null)
  execute function public.count_shopping_use();

-- Il reparto scelto a mano diventa quello proposto la prossima volta.
create function public.remember_category() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.shopping_item_stats set category = new.category
    where household_id = new.household_id and name_norm = lower(btrim(new.name));
  return null;
end;
$$;
create trigger remember_category after update of category on public.shopping_items
  for each row when (old.category is distinct from new.category)
  execute function public.remember_category();

revoke execute on function public.touch_row(), public.count_shopping_use(), public.remember_category() from public, anon, authenticated;

-- ——— Realtime ———————————————————————————————————————————————————————————————
-- Realtime applica le stesse policy di select: ognuno riceve solo le righe della propria casa.
alter publication supabase_realtime add table public.shopping_items;
