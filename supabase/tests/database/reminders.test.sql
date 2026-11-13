begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.dev');

insert into public.items (id, user_id, kind, category, title, starts_at, reminder_minutes, timezone) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'task', 'work', 'Com hora',
   '2026-12-01 14:00-03', 60, 'America/Sao_Paulo');
select is((select remind_at from public.items where id = '10000000-0000-0000-0000-000000000001'),
  '2026-12-01 13:00-03'::timestamptz, 'com hora: 1 h antes');

insert into public.items (id, user_id, kind, category, title, starts_at, all_day, reminder_minutes, timezone) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'task', 'leisure', 'Dia inteiro',
   '2026-12-01 00:00-03', true, 0, 'America/Sao_Paulo'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'task', 'leisure', 'Dia inteiro véspera',
   '2026-12-01 00:00-03', true, 1440, 'America/Sao_Paulo');
select is((select remind_at from public.items where id = '10000000-0000-0000-0000-000000000002'),
  '2026-12-01 09:00-03'::timestamptz, 'dia inteiro: 09:00 no fuso do item');
select is((select remind_at from public.items where id = '10000000-0000-0000-0000-000000000003'),
  '2026-11-30 09:00-03'::timestamptz, 'dia inteiro, 1 dia antes: 09:00 da véspera');

insert into public.items (id, user_id, kind, category, title, starts_at, reminder_minutes) values
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'task', 'work', 'Sem lembrete',
   '2026-12-01 14:00-03', null),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000a', 'task', 'work', 'Sem data',
   null, 10);
select ok((select remind_at is null from public.items where id = '10000000-0000-0000-0000-000000000004'),
  'sem lembrete: remind_at nulo');
select ok((select remind_at is null from public.items where id = '10000000-0000-0000-0000-000000000005'),
  'sem data: remind_at nulo');

-- Reenvio após edição
update public.items set reminder_sent_at = now() where id = '10000000-0000-0000-0000-000000000001';
update public.items set title = 'Novo título' where id = '10000000-0000-0000-0000-000000000001';
select ok((select reminder_sent_at is not null from public.items where id = '10000000-0000-0000-0000-000000000001'),
  'mudar só o título mantém reminder_sent_at');
update public.items set starts_at = '2026-12-02 14:00-03' where id = '10000000-0000-0000-0000-000000000001';
select ok((select reminder_sent_at is null and remind_at = '2026-12-02 13:00-03'::timestamptz
  from public.items where id = '10000000-0000-0000-0000-000000000001'),
  'mudar starts_at zera reminder_sent_at e recalcula remind_at');

-- claim_due_reminders
insert into public.items (id, user_id, kind, category, title, starts_at, reminder_minutes) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'task', 'work', 'Vencido',
   now() - interval '1 minute', 0),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'task', 'work', 'Velho',
   now() - interval '2 hours', 0);
insert into public.items (id, user_id, kind, category, title, starts_at, reminder_minutes, done_at) values
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'task', 'work', 'Feito',
   now() - interval '1 minute', 0, now());

set local role service_role;
select results_eq(
  $$select id from public.claim_due_reminders()$$,
  $$values ('20000000-0000-0000-0000-000000000001'::uuid)$$,
  'retorna só o lembrete vencido recente e pendente');
select is((select count(*)::int from public.claim_due_reminders()), 0, 'segunda chamada não retorna nada');
reset role;

select ok((select reminder_sent_at is not null from public.items where id = '20000000-0000-0000-0000-000000000001'),
  'vencido marcado como enviado');
select ok((select reminder_sent_at is not null from public.items where id = '20000000-0000-0000-0000-000000000002'),
  'vencido há mais de 1 h marcado como enviado sem notificar');
select ok((select reminder_sent_at is null from public.items where id = '20000000-0000-0000-0000-000000000003'),
  'tarefa concluída não é reivindicada');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$select public.claim_due_reminders()$$, '42501', null,
  'authenticated não executa claim_due_reminders');
reset role;

select * from finish();
rollback;
