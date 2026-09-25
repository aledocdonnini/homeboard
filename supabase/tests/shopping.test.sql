-- Lista della spesa: permessi, orologio del server, suggerimenti. Esegui: npm run test:db
-- Anna è membro, Carla un'estranea, la TV un dispositivo della casa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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
update public.shopping_items set deleted_at = now();
select is((select count(*) from public.shopping_items where deleted_at is not null), 1::bigint, 'Cancellare = tombstone');

-- ——— Carla, estranea ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.shopping_items), 0::bigint, 'Carla non vede la lista di Anna');
select is((select count(*) from public.shopping_item_stats), 0::bigint, 'Carla non vede i suggerimenti di Anna');
select is_empty($$ update public.shopping_items set checked = true returning 1 $$, 'Carla non spunta niente');

-- ——— La TV ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","is_anonymous":true}', true);
select is((select name from public.shopping_items), ' Latte ', 'La TV legge la lista');
select is_empty($$ update public.shopping_items set checked = true returning 1 $$, 'La TV non modifica');
select throws_ok(
  $$ insert into public.shopping_items (household_id, name) values ('00000000-0000-0000-0000-000000000001', 'Dalla TV') $$,
  '42501', null, 'La TV non aggiunge');

select * from finish();
rollback;
