begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev');

insert into public.items (user_id, kind, category, title) values
  ('00000000-0000-0000-0000-00000000000b', 'task', 'work', 'Item de B');

-- Agir como usuário A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.items), 0, 'A não enxerga itens de B');

select lives_ok(
  $$insert into public.items (kind, category, title) values ('task', 'leisure', 'Meu item')$$,
  'A cria item sem informar user_id');

select is((select user_id from public.items where title = 'Meu item'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'user_id padrão = auth.uid()');

select throws_ok(
  $$insert into public.items (user_id, kind, category, title)
    values ('00000000-0000-0000-0000-00000000000b', 'task', 'work', 'Invasão')$$,
  '42501', null, 'A não cria item em nome de B');

update public.items set title = 'Alterado por A' where title = 'Item de B';
reset role;
select is((select count(*)::int from public.items where title = 'Item de B'), 1,
  'A não altera item de B');
set local role authenticated;

select throws_ok($$insert into public.items (kind, category, title) values ('event', 'work', 'Sem data')$$,
  '23514', null, 'compromisso sem starts_at falha');
select throws_ok($$insert into public.items (kind, category, title, starts_at, ends_at)
  values ('event', 'work', 'Fim antes', '2026-12-01 14:00-03', '2026-12-01 13:00-03')$$,
  '23514', null, 'ends_at <= starts_at falha');
select throws_ok($$insert into public.items (kind, category, title, starts_at, done_at)
  values ('event', 'work', 'Concluído', '2026-12-01 14:00-03', now())$$,
  '23514', null, 'compromisso com done_at falha');
select throws_ok($$insert into public.items (kind, category, title, starts_at, reminder_minutes)
  values ('task', 'work', 'Lembrete 5', '2026-12-01 14:00-03', 5)$$,
  '23514', null, 'reminder_minutes = 5 falha');
select throws_ok($$insert into public.items (kind, category, title) values ('task', 'work', '')$$,
  '23514', null, 'título vazio falha');

select lives_ok($$insert into public.push_subscriptions (endpoint, p256dh, auth)
  values ('https://fcm.googleapis.com/fcm/send/1', 'k', 'a')$$, 'A cria inscrição');

reset role;

select throws_ok($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-00000000000b', 'https://fcm.googleapis.com/fcm/send/1', 'k', 'a')$$,
  '23505', null, 'endpoint é único');

-- Limites
insert into public.items (user_id, kind, category, title)
  select '00000000-0000-0000-0000-00000000000b', 'task', 'work', 'x' || g
  from generate_series(2, 2000) g;
select throws_ok($$insert into public.items (user_id, kind, category, title)
  values ('00000000-0000-0000-0000-00000000000b', 'task', 'work', 'excesso')$$,
  'P0001', 'limite_itens', '2.001º item lança limite_itens');

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  select '00000000-0000-0000-0000-00000000000b', 'https://fcm.googleapis.com/fcm/send/b' || g, 'k', 'a'
  from generate_series(1, 10) g;
select throws_ok($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-00000000000b', 'https://fcm.googleapis.com/fcm/send/b11', 'k', 'a')$$,
  'P0001', 'limite_dispositivos', '11ª inscrição lança limite_dispositivos');

select * from finish();
rollback;
