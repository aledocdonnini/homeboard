-- Roby assistente: il Pi scrive i dati di tutti i giorni, timer, note, frasi non capite. Esegui: npm run test:db
-- Anna è membro, Carla un'estranea, il Pi un dispositivo della casa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'anna@pgtap.invalid', false),
  ('00000000-0000-0000-0000-00000000000c', 'carla@pgtap.invalid', false),
  ('00000000-0000-0000-0000-0000000000f1', null, true);
insert into public.households (id, name) values ('00000000-0000-0000-0000-000000000001', 'Casa');
insert into public.household_members (household_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner');
insert into public.devices (household_id, user_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1');

set local role authenticated;

-- ——— Il Pi ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","is_anonymous":true}', true);
select lives_ok($$
  insert into public.timers (id, household_id, label, duration_s, ends_at)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', 'pasta', 600, now() + interval '10 minutes')
$$, 'Il Pi pubblica un timer');
select isnt_empty($$ update public.timers set status = 'ringing' returning 1 $$, 'Il Pi segna che suona');
select lives_ok($$
  insert into public.notes (household_id, body, source)
  values ('00000000-0000-0000-0000-000000000001', 'La chiave di scorta è da mia madre', 'voce')
$$, 'Il Pi salva una nota detta a voce');
select lives_ok($$
  insert into public.unparsed_log (household_id, text, source) values ('00000000-0000-0000-0000-000000000001', 'fai il caffè', 'voce')
$$, 'Il Pi registra una frase non capita');
select is((select count(*) from public.unparsed_log), 0::bigint, 'Il Pi non rilegge le frasi registrate');
select is_empty($$ update public.household_members set display_name = 'Pi' returning 1 $$, 'Il Pi non tocca i membri');
select throws_ok($$ delete from public.push_subscriptions $$, '42501', null, 'Il Pi non tocca le notifiche');
select throws_ok(
  $$ delete from public.shopping_items $$, '42501', null, 'Il Pi non cancella righe (si toglie con deleted_at)');

-- ——— Anna ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select label || ' ' || status from public.timers), 'pasta ringing', 'Anna vede il timer del Pi');
select throws_ok($$
  insert into public.timers (id, household_id, duration_s, ends_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 60, now() + interval '1 minute')
$$, '42501', null, 'I timer li tiene il Pi, non il telefono');
select is_empty($$ delete from public.timers returning 1 $$, 'Anna non ferma il timer dal telefono');
select is((select text from public.unparsed_log), 'fai il caffè', 'Anna legge le frasi non capite');

select lives_ok($$
  update public.notes set embedding = array_fill(0.1, array[384])::extensions.vector
$$, 'Il vettore ha 384 dimensioni');
select throws_ok($$
  update public.notes set embedding = array_fill(0.1, array[3])::extensions.vector
$$, '22000', null, 'Un vettore di dimensioni sbagliate è rifiutato');
update public.notes set body = 'La chiave di scorta è dalla vicina';
select is((select embedding from public.notes), null, 'Cambia il testo: l''embedding va ricalcolato');
select is(
  (select body from public.notes where tsv @@ websearch_to_tsquery('italian', 'chiave scorte')),
  'La chiave di scorta è dalla vicina', 'Ricerca per parole in italiano (scorte → scorta)');

-- ——— Carla, estranea ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.timers) + (select count(*) from public.notes), 0::bigint, 'Carla non vede timer e note');
select throws_ok($$
  insert into public.notes (household_id, body) values ('00000000-0000-0000-0000-000000000001', 'intrusa')
$$, '42501', null, 'Carla non scrive note nella casa di Anna');
select throws_ok($$
  insert into public.unparsed_log (household_id, text, source) values ('00000000-0000-0000-0000-000000000001', 'x', 'pwa')
$$, '42501', null, 'Carla non scrive nel registro');

select * from finish();
rollback;
