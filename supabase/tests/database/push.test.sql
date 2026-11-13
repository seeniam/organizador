begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

-- B usou o navegador antes
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-00000000000b', 'https://fcm.googleapis.com/fcm/send/shared', 'old', 'old');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$select public.claim_push_subscription('https://fcm.googleapis.com/fcm/send/shared', 'new', 'new', 'ua')$$,
  'A reivindica um endpoint que era de B');
select lives_ok(
  $$select public.claim_push_subscription('https://fcm.googleapis.com/fcm/send/shared', 'newer', 'newer', 'ua')$$,
  'reivindicar de novo atualiza as chaves');

reset role;
select is(
  (select user_id from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/shared'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'o endpoint agora pertence a A');
select is(
  (select p256dh from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/shared'),
  'newer', 'chaves atualizadas');

set local role anon;
select throws_ok(
  $$select public.claim_push_subscription('https://fcm.googleapis.com/fcm/send/x', 'k', 'a', null)$$,
  '42501', null, 'anônimo não pode reivindicar');
reset role;

select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('00000000-0000-0000-0000-00000000000a', 'https://169.254.169.254/latest', 'k', 'a')$$,
  '23514', null, 'endpoint fora dos serviços de push é recusado');

select * from finish();
rollback;
