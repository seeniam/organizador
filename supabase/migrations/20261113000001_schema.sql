-- Itens (tarefas e compromissos) e inscrições de push

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('task', 'event')),
  category text not null check (category in ('leisure', 'work')),
  title text not null check (char_length(title) between 1 and 200),
  notes text check (notes is null or char_length(notes) <= 5000),
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  reminder_minutes int check (reminder_minutes in (0, 10, 60, 1440)),
  remind_at timestamptz,
  reminder_sent_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_requires_start check (kind <> 'event' or starts_at is not null),
  constraint ends_after_start check (ends_at is null or (kind = 'event' and ends_at > starts_at)),
  constraint only_tasks_are_done check (kind = 'task' or done_at is null)
);

create index items_user_starts_idx on public.items (user_id, starts_at);
create index items_due_reminders_idx on public.items (remind_at)
  where reminder_sent_at is null and done_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- updated_at
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();

-- Limites por usuário (protegem a cota gratuita)
create function public.enforce_item_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.items where user_id = new.user_id) >= 2000 then
    raise exception 'limite_itens';
  end if;
  return new;
end;
$$;

create trigger items_enforce_limit before insert on public.items
  for each row execute function public.enforce_item_limit();

create function public.enforce_subscription_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Reativar um aparelho já cadastrado (mesmo endpoint) não conta como novo
  if (select count(*) from public.push_subscriptions
       where user_id = new.user_id and endpoint <> new.endpoint) >= 10 then
    raise exception 'limite_dispositivos';
  end if;
  return new;
end;
$$;

create trigger push_subscriptions_enforce_limit before insert on public.push_subscriptions
  for each row execute function public.enforce_subscription_limit();

revoke execute on function public.enforce_item_limit() from public, anon, authenticated;
revoke execute on function public.enforce_subscription_limit() from public, anon, authenticated;

-- RLS
alter table public.items enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "items: dono lê" on public.items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "items: dono cria" on public.items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "items: dono altera" on public.items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "items: dono exclui" on public.items for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "push: dono lê" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push: dono cria" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "push: dono altera" on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push: dono exclui" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Permissões explícitas (não depende da exposição automática de tabelas)
revoke all on public.items, public.push_subscriptions from anon;
grant select, delete on public.items to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.items, public.push_subscriptions to service_role;

-- Colunas controladas pelo servidor não podem ser escritas pelo cliente
revoke insert, update on public.items from anon, authenticated;
grant insert (kind, category, title, notes, starts_at, ends_at, all_day, timezone, reminder_minutes, done_at)
  on public.items to authenticated;
grant update (kind, category, title, notes, starts_at, ends_at, all_day, timezone, reminder_minutes, done_at)
  on public.items to authenticated;
