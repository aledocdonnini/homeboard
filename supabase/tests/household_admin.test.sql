-- La casa la crea solo chi è autorizzato; il proprietario aggiunge le persone per email. Esegui: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'anna@pgtap.invalid', false),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@pgtap.invalid', false),
  ('00000000-0000-0000-0000-00000000000c', 'carla@pgtap.invalid', false);
insert into public.signup_allowlist (email, can_create_household) values ('anna@pgtap.invalid', true);

set local role authenticated;

-- Bruno non può creare case.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","email":"bruno@pgtap.invalid"}', true);
select is(public.can_create_household(), false, 'Bruno non è autorizzato a creare case');
select throws_ok($$ select public.create_household('Casa di Bruno') $$, '42501', null, 'e la creazione viene rifiutata');

-- Anna sì.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","email":"anna@pgtap.invalid"}', true);
select set_config('t.hid', public.create_household('Casa')::text, true);
select is(public.add_member(current_setting('t.hid')::uuid, ' Bruno@PGTAP.invalid '), 'aggiunta', 'Anna aggiunge Bruno, che ha già un account');
select is((select count(*) from public.household_members where household_id = current_setting('t.hid')::uuid), 2::bigint, 'Bruno è in casa subito');
select is(public.add_member(current_setting('t.hid')::uuid, 'nuova@pgtap.invalid'), 'in_attesa', 'Una persona senza account resta in attesa');
select throws_ok(format($$ select public.add_member(%L, 'non-una-email') $$, current_setting('t.hid')), '22023', null, 'Email non valida');

-- Il primo accesso della persona in attesa: entra da sola nella casa giusta.
reset role;
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-0000-0000-00000000000d', 'nuova@pgtap.invalid', false);
select is((select household_id from public.household_members where user_id = '00000000-0000-0000-0000-00000000000d'),
  current_setting('t.hid')::uuid, 'Al primo accesso entra nella casa in cui era stata aggiunta');

-- Bruno, membro ma non proprietario, e Carla, estranea, non aggiungono nessuno.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","email":"bruno@pgtap.invalid"}', true);
select throws_ok(format($$ select public.add_member(%L, 'amico@pgtap.invalid') $$, current_setting('t.hid')), '42501', null, 'Un membro non proprietario non aggiunge');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated","email":"carla@pgtap.invalid"}', true);
select throws_ok(format($$ select public.add_member(%L, 'carla@pgtap.invalid') $$, current_setting('t.hid')), '42501', null, 'Un''estranea non si aggiunge da sola');

select * from finish();
rollback;
