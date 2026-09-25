-- Policy di case, inviti e dispositivi con utenti diversi. Esegui: npm run test:db
-- Anna crea la casa, Bruno entra con un invito, Carla è un'estranea, la TV è un utente anonimo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'anna@pgtap.invalid', false),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@pgtap.invalid', false),
  ('00000000-0000-0000-0000-00000000000c', 'carla@pgtap.invalid', false),
  ('00000000-0000-0000-0000-0000000000f1', null, true);

-- ——— Anna crea la casa ———
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","is_anonymous":false,"email":"anna@test.it"}', true);
select set_config('t.hid', public.create_household('Casa Donnini')::text, true);

select is((select count(*) from public.households), 1::bigint, 'Anna vede la sua casa');
select is((select role || ' ' || display_name from public.household_members where user_id = auth.uid()), 'owner anna', 'Anna è proprietaria, col nome dall''email');
with i as (insert into public.household_invites (household_id) values (current_setting('t.hid')::uuid) returning token)
select set_config('t.invite', token::text, true) from i;
select is((select count(*) from public.household_invites), 1::bigint, 'Anna crea un invito');

-- ——— Carla, estranea ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated","is_anonymous":false,"email":"carla@test.it"}', true);
select is((select count(*) from public.households), 0::bigint, 'Carla non vede la casa');
select is((select count(*) from public.household_invites), 0::bigint, 'Carla non vede gli inviti');
select is_empty($$ update public.households set name = 'Presa' returning 1 $$, 'Carla non modifica la casa');
select throws_ok(
  format($$ insert into public.household_invites (household_id) values (%L) $$, current_setting('t.hid')),
  '42501', null, 'Carla non crea inviti per la casa di Anna');

-- ——— Bruno accetta l'invito ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","is_anonymous":false,"email":"bruno@test.it"}', true);
select is(public.accept_invite(current_setting('t.invite')::uuid), current_setting('t.hid')::uuid, 'Bruno accetta l''invito');
select is((select count(*) from public.household_members), 2::bigint, 'Bruno vede i due membri');
select throws_ok(
  format($$ select public.accept_invite(%L) $$, current_setting('t.invite')),
  'P0002', null, 'L''invito vale una volta sola');
select throws_ok(
  $$ update public.household_members set role = 'owner' where user_id = auth.uid() $$,
  '42501', null, 'Bruno non si promuove a proprietario');
select is_empty(
  $$ delete from public.household_members where user_id = '00000000-0000-0000-0000-00000000000a' returning 1 $$,
  'Bruno non toglie Anna');
select isnt_empty($$ update public.households set name = 'Casa nostra' returning 1 $$, 'Bruno, membro, rinomina la casa');

-- ——— La TV (anonima) ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","is_anonymous":true}', true);
select throws_ok($$ select public.create_household('Casa TV') $$, '42501', null, 'La TV non crea case');
select set_config('t.code', public.start_pairing(), true);
select matches(current_setting('t.code'), '^[A-HJKMNP-Z2-9]{6}$', 'La TV riceve un codice di 6 caratteri');
select is((select count(*) from public.households), 0::bigint, 'Prima dell''abbinamento la TV non vede niente');

-- ——— Abbinamento ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated","is_anonymous":false,"email":"carla@test.it"}', true);
select throws_ok(
  format($$ select public.claim_pairing(%L, %L) $$, current_setting('t.code'), current_setting('t.hid')),
  '42501', null, 'Carla non abbina la TV alla casa di Anna');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","is_anonymous":false,"email":"anna@test.it"}', true);
select lives_ok(
  format($$ select public.claim_pairing(%L, %L, 'Crezar') $$, lower(current_setting('t.code')), current_setting('t.hid')),
  'Anna abbina la TV (il codice non distingue maiuscole)');
select throws_ok(
  format($$ select public.claim_pairing(%L, %L) $$, current_setting('t.code'), current_setting('t.hid')),
  'P0002', null, 'Il codice si brucia');

-- ——— La TV abbinata legge soltanto ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","is_anonymous":true}', true);
select is((select name from public.households), 'Casa nostra', 'La TV legge la casa');
select is((select name from public.devices), 'Crezar', 'La TV vede la propria riga');
select is_empty($$ update public.households set name = 'TV' returning 1 $$, 'La TV non modifica la casa');
select throws_ok(
  format($$ insert into public.household_invites (household_id) values (%L) $$, current_setting('t.hid')),
  '42501', null, 'La TV non crea inviti');
select throws_ok(
  format($$ select public.accept_invite(%L) $$, gen_random_uuid()),
  '42501', null, 'La TV non accetta inviti');

-- ——— Revoca ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","is_anonymous":false,"email":"anna@test.it"}', true);
delete from public.devices;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","is_anonymous":true}', true);
select is((select count(*) from public.households), 0::bigint, 'Revocata, la TV non vede più la casa');

-- ——— Senza login ———
reset role;
set local role anon;
select throws_ok($$ select public.create_household('Anonima') $$, '42501', null, 'Senza login non si crea niente');

select * from finish();
rollback;
