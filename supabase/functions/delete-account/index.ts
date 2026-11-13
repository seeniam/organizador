// Exclui a conta do usuário logado. Itens e inscrições são apagados em cascata.
import { adminClient, cors, json, requestUser } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const user = await requestUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ deleted: true });
});
