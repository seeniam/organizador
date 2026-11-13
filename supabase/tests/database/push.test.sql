begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

-- B usou o navegador antes (mesmas chaves que o navegador ainda tem)
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-00000000000b', 'https://fcm.googleapis.com/fcm/send/shared', 'K1', 'A1'),
       ('00000000-0000-0000-0000-00000000000b', 'https://fcm.googleapis.com/fcm/send/other', 'K2', 'A2');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$select public.claim_push_subscription('https://fcm.googleapis.com/fcm/send/other', 'X', 'Y', 'ua')$$,
  '42501', 'endpoint_em_uso', 'sem as chaves certas, não toma a inscrição de outra conta');

select lives_ok(
  $$select public.claim_push_subscription('https://fcm.googleapis.com/fcm/send/shared', 'K1', 'A1', 'ua')$$,
  'com as mesmas chaves (mesmo navegador), A reivindica o endpoint de B');
select lives_ok(
  $$select public.claim_push_subscription('https://fcm.googleapis.com/fcm/send/shared', 'K3', 'A3', 'ua')$$,
  'o dono atualiza as próprias chaves');

reset role;
select is(
  (select user_id from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/shared'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'o endpoint agora pertence a A');
select is(
  (select p256dh from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/shared'),
  'K3', 'chaves atualizadas');
select is(
  (select user_id || ':' || p256dh from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/other'),
  '00000000-0000-0000-0000-00000000000b:K2', 'a inscrição de B continua intacta');

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
