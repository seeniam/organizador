-- Reivindica um endpoint de push para o usuário atual.
-- Se outra conta usou o mesmo navegador antes, a inscrição antiga é removida,
-- para que lembretes de uma conta nunca cheguem ao aparelho de outra.

create function public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Só transfere com prova de posse: as chaves precisam ser as do mesmo navegador.
  if exists (
    select 1 from public.push_subscriptions
     where endpoint = p_endpoint and user_id <> uid
       and (p256dh <> p_p256dh or auth <> p_auth)
  ) then
    raise exception 'endpoint_em_uso' using errcode = '42501';
  end if;

  delete from public.push_subscriptions
   where endpoint = p_endpoint and user_id <> uid;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent;
end;
$$;

revoke execute on function public.claim_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text, text) to authenticated;

-- Só endpoints dos serviços de push dos navegadores (evita SSRF a partir das Edge Functions)
alter table public.push_subscriptions add constraint push_endpoint_allowed check (
  endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/'
);
