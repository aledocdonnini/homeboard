-- Lista della spesa: permessi, orologio del server, suggerimenti. Esegui: npm run test:db
-- Anna è membro, Carla un'estranea, la TV un dispositivo della casa (legge e, a voce, scrive).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'anna@pgtap.invalid', false),
  ('00000000-0000-0000-0000-00000000000c', 'carla@pgtap.invalid', false),
  ('00000000-0000-0000-0000-0000000000f1', null, true);
insert into public.households (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Casa'),
  ('00000000-0000-0000-0000-000000000002', 'Casa di Carla');
insert into public.household_members (household_id, user_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c');
insert into public.devices (household_id, user_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1');

-- ——— Anna ———
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into public.shopping_items (id, household_id, name, category, updated_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', ' Latte ', 'latticini', '2000-01-01');
select ok((select updated_at > '2020-01-01' from public.shopping_items), 'updated_at lo decide il server, non il client');
select is((select updated_by from public.shopping_items), auth.uid(), 'updated_by = chi scrive');
select is((select uses || ' ' || name || ' ' || category from public.shopping_item_stats), '1 Latte latticini', 'Il primo inserimento crea il suggerimento');

update public.shopping_items set checked = true;
update public.shopping_items set checked = false;
select is((select uses from public.shopping_item_stats), 2, 'Rimettere in lista una cosa spuntata conta come uso');
update public.shopping_items set category = 'colazione';
select is((select category from public.shopping_item_stats), 'colazione', 'Il reparto scelto a mano diventa quello proposto');

select throws_ok($$ delete from public.shopping_items $$, '42501', null, 'Niente delete: si usa deleted_at');
select throws_ok(
  $$ update public.shopping_items set household_id = '00000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'Un elemento non cambia casa');
select throws_ok(
  $$ insert into public.shopping_items (household_id, name) values ('00000000-0000-0000-0000-000000000002', 'Intruso') $$,
  '42501', null, 'Anna non scrive nella lista di Carla');
select throws_ok(
  $$ insert into public.shopping_items (household_id, name) values ('00000000-0000-0000-0000-000000000001', '   ') $$,
  '23514', null, 'Nome vuoto rifiutato');
select throws_ok(
  $$ insert into public.shopping_items (household_id, name) values ('00000000-0000-0000-0000-000000000001', 'LATTE') $$,
  '23505', null, 'La stessa cosa due volte in lista: no (offline da due telefoni)');
update public.shopping_items set deleted_at = now();
select lives_ok(
  $$ insert into public.shopping_items (household_id, name) values ('00000000-0000-0000-0000-000000000001', 'Latte') $$,
  'Tolta dalla lista, si può aggiungere di nuovo');
select is((select count(*) from public.shopping_items where deleted_at is not null), 1::bigint, 'Cancellare = tombstone');
update public.shopping_items set deleted_at = now() where deleted_at is null;

-- ——— Carla, estranea ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.shopping_items), 0::bigint, 'Carla non vede la lista di Anna');
select is((select count(*) from public.shopping_item_stats), 0::bigint, 'Carla non vede i suggerimenti di Anna');
select is_empty($$ update public.shopping_items set checked = true returning 1 $$, 'Carla non spunta niente');

-- ——— La TV ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","is_anonymous":true}', true);
select is((select count(*) from public.shopping_items), 2::bigint, 'La TV legge la lista (anche le righe tolte, per la sincronizzazione)');
select isnt_empty($$ update public.shopping_items set checked = true returning 1 $$, 'La TV spunta (a voce)');
select lives_ok(
  $$ insert into public.shopping_items (household_id, name) values ('00000000-0000-0000-0000-000000000001', 'Dalla TV') $$,
  'La TV aggiunge (a voce)');

select * from finish();
rollback;
