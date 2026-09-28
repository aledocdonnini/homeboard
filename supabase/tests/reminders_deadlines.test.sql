-- Promemoria e scadenze: permessi, ricorrenze ben formate, "fatta" con rinnovo. Esegui: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'anna@pgtap.invalid', false),
  ('00000000-0000-0000-0000-00000000000c', 'carla@pgtap.invalid', false),
  ('00000000-0000-0000-0000-0000000000f1', null, true);
insert into public.households (id, name) values ('00000000-0000-0000-0000-000000000001', 'Casa');
insert into public.household_members (household_id, user_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a');
insert into public.devices (household_id, user_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- ——— Anna ———
select lives_ok($$
  insert into public.reminders (household_id, title, start_date, at_time, recurrence)
  values ('00000000-0000-0000-0000-000000000001', 'Plastica', '2026-09-29', '21:00', '{"freq":"week","interval":1,"byWeekday":[1]}')
$$, 'Anna crea un promemoria settimanale');
select throws_ok($$
  insert into public.reminders (household_id, title, start_date, at_time, recurrence)
  values ('00000000-0000-0000-0000-000000000001', 'Rotto', '2026-09-29', '21:00', '{"freq":"ora","interval":1}')
$$, '23514', null, 'Ricorrenza sconosciuta rifiutata');
select throws_ok($$
  insert into public.reminders (household_id, title, start_date, at_time, recurrence)
  values ('00000000-0000-0000-0000-000000000001', 'Rotto', '2026-09-29', '21:00', '{"freq":"week","interval":1,"byWeekday":[9]}')
$$, '23514', null, 'Giorno della settimana fuori scala rifiutato');
select throws_ok($$
  insert into public.deadlines (household_id, title, start_date, due_date, recurrence)
  values ('00000000-0000-0000-0000-000000000001', 'Bollo', '2026-09-28', '2026-09-28', '{"freq":"day","interval":1}')
$$, '23514', null, 'Una scadenza non si ripete ogni giorno');
select throws_ok($$
  insert into public.deadlines (household_id, title, start_date, due_date, notify_days)
  values ('00000000-0000-0000-0000-000000000001', 'Bollo', '2026-09-28', '2026-09-28', '{7,-1}')
$$, '23514', null, 'Anticipo negativo rifiutato');

insert into public.deadlines (id, household_id, title, category, start_date, due_date, recurrence, notify_days)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000001', 'Bollo auto', 'auto',
          '2025-09-28', '2026-09-28', '{"freq":"year","interval":1}', '{30,7,0}');
insert into public.deadlines (id, household_id, title, start_date, due_date)
  values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000001', 'Multa', '2026-10-10', '2026-10-10');

select throws_ok(
  $$ select public.complete_deadline('00000000-0000-0000-0000-0000000000d1', '2026-09-01') $$,
  '22023', null, 'La prossima scadenza non può venire prima di quella fatta');
select isnt(public.complete_deadline('00000000-0000-0000-0000-0000000000d1', '2027-09-28'), null, 'Fatta: si apre la prossima');
select is((select due_date || ' ' || start_date || ' ' || notify_days::text from public.deadlines where done_at is null and title = 'Bollo auto'),
  '2027-09-28 2025-09-28 {30,7,0}', 'La prossima tiene àncora e anticipi');
select throws_ok(
  $$ select public.complete_deadline('00000000-0000-0000-0000-0000000000d1', '2028-09-28') $$,
  'P0002', null, 'Una scadenza già fatta non si rifà');
select throws_ok(
  $$ select public.complete_deadline('00000000-0000-0000-0000-0000000000d2', '2026-11-10') $$,
  '22023', null, 'Una scadenza singola non si rinnova');

-- ——— Carla, estranea ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.deadlines) + (select count(*) from public.reminders), 0::bigint, 'Carla non vede niente');

-- ——— La TV ———
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","is_anonymous":true}', true);
select is((select count(*) from public.deadlines where done_at is null), 2::bigint, 'La TV legge le scadenze aperte');
select isnt_empty($$ update public.reminders set title = 'TV' returning 1 $$, 'La TV modifica i promemoria (a voce)');
select lives_ok(
  $$ select public.complete_deadline((select id from public.deadlines where done_at is null and title = 'Multa')) $$,
  'La TV segna fatta una scadenza ("ho pagato la multa")');

select * from finish();
rollback;
