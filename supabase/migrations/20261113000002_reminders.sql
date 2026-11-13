-- Cálculo de remind_at e reivindicação atômica dos lembretes vencidos

create function public.compute_remind_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.reminder_minutes is null or new.starts_at is null then
    new.remind_at := null;
  elsif new.all_day then
    new.remind_at := (((new.starts_at at time zone new.timezone)::date + time '09:00') at time zone new.timezone)
      - make_interval(mins => new.reminder_minutes);
  else
    new.remind_at := new.starts_at - make_interval(mins => new.reminder_minutes);
  end if;

  if tg_op = 'UPDATE' and (
    new.starts_at is distinct from old.starts_at
    or new.reminder_minutes is distinct from old.reminder_minutes
    or new.all_day is distinct from old.all_day
    or new.timezone is distinct from old.timezone
  ) then
    new.reminder_sent_at := null;
  end if;

  return new;
end;
$$;

create trigger items_compute_remind_at before insert or update on public.items
  for each row execute function public.compute_remind_at();

create function public.claim_due_reminders(max_rows int default 200)
returns setof public.items
language plpgsql security definer set search_path = '' as $$
begin
  -- Lembretes atrasados há mais de 1 hora: marca como enviados sem notificar
  update public.items
     set reminder_sent_at = now()
   where reminder_sent_at is null
     and done_at is null
     and remind_at < now() - interval '1 hour';

  return query
  update public.items i
     set reminder_sent_at = now()
   where i.id in (
     select id from public.items
      where reminder_sent_at is null
        and done_at is null
        and remind_at <= now()
      order by remind_at
      limit max_rows
      for update skip locked
   )
  returning i.*;
end;
$$;

revoke execute on function public.claim_due_reminders(int) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(int) to service_role;
