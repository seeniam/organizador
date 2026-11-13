// Chamada pelo pg_cron a cada minuto. Reivindica lembretes vencidos e envia push.
import { adminClient, json } from '../_shared/admin.ts';
import { buildReminderPayload, sendToUser, type ReminderItem } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  const admin = adminClient();
  const { data, error } = await admin.rpc('claim_due_reminders', { max_rows: 200 });
  if (error) {
    console.error('claim_due_reminders', error);
    return json({ error: error.message }, 500);
  }

  const items = (data ?? []) as ReminderItem[];
  let sent = 0;
  let removed = 0;
  for (const item of items) {
    try {
      const r = await sendToUser(admin, item.user_id, buildReminderPayload(item));
      sent += r.sent;
      removed += r.removed;
    } catch (e) {
      console.error('falha no item', item.id, (e as Error).message);
    }
  }
  return json({ claimed: items.length, sent, removed });
});
