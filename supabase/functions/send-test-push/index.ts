// Envia uma notificação de teste para todos os dispositivos do usuário logado.
import { adminClient, cors, json, requestUser } from '../_shared/admin.ts';
import { sendToUser } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await requestUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const r = await sendToUser(adminClient(), user.id, {
    title: 'Lembretes ativados',
    body: 'Este é um teste do Organizador.',
    itemId: null,
    url: '/configuracoes',
    tag: 'teste',
  });
  return json(r);
});
