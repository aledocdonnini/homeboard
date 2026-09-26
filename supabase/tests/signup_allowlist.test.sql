-- Solo su invito: l'hook che Supabase chiama prima di creare un utente. Esegui: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.signup_allowlist (email) values ('invitata@pgtap.invalid');

select is(public.hook_before_user_created('{"user":{"email":"invitata@pgtap.invalid"}}'), '{}'::jsonb, 'Email in elenco: passa');
select is(public.hook_before_user_created('{"user":{"email":"  Invitata@PGTAP.invalid "}}'), '{}'::jsonb, 'Maiuscole e spazi non contano');
select is(public.hook_before_user_created('{"user":{"email":"estranea@pgtap.invalid"}}') -> 'error' ->> 'http_code', '403', 'Email non in elenco: respinta');
select is(public.hook_before_user_created('{"user":{"is_anonymous":true}}'), '{}'::jsonb, 'Anonimo (la TV): passa');

set local role authenticated;
select throws_ok($$ select public.hook_before_user_created('{"user":{"email":"x@y.z"}}') $$, '42501', null, 'Dall''app non si chiama');

select * from finish();
rollback;
