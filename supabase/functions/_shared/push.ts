// Envio de Web Push compartilhado pelas Edge Functions.
import webpush from 'npm:web-push@3.6.7';

export interface PushPayload {
  title: string;
  body: string;
  itemId: string | null;
  url: string;
  tag: string;
}

export interface ReminderItem {
  id: string;
  user_id: string;
  title: string;
  category: 'work' | 'leisure';
  starts_at: string | null;
  all_day: boolean;
  timezone: string;
}

export interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type SendFn = (sub: SubscriptionRow, body: string) => Promise<unknown>;

// deno-lint-ignore no-explicit-any
type AdminLike = { from(table: string): any };

const CATEGORY_LABEL = { work: 'Profissional', leisure: 'Lazer' } as const;

function part(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((p) => p.type === type)?.value ?? '';
}

export function buildReminderPayload(item: ReminderItem): PushPayload {
  let when = '';
  if (item.starts_at) {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: item.timezone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(item.starts_at));
    const date = `${part(parts, 'day')}/${part(parts, 'month')}`;
    when = item.all_day ? date : `${date} às ${part(parts, 'hour')}:${part(parts, 'minute')}`;
  }
  return {
    title: item.title,
    body: [when, CATEGORY_LABEL[item.category]].filter(Boolean).join(' · '),
    itemId: item.id,
    url: `/?item=${item.id}`,
    tag: `item-${item.id}`,
  };
}

let configured = false;

export const defaultSend: SendFn = (sub, body) => {
  if (!configured) {
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );
    configured = true;
  }
  return webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
    TTL: 3600,
    urgency: 'high',
  });
};

export async function sendToUser(
  admin: AdminLike,
  userId: string,
  payload: PushPayload,
  send: SendFn = defaultSend,
): Promise<{ sent: number; removed: number }> {
  const { data, error } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId);
  if (error) throw error;
  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  for (const sub of data ?? []) {
    try {
      await send(sub, body);
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        removed++;
      } else {
        console.error('falha ao enviar push', status, (e as Error).message);
      }
    }
  }
  return { sent, removed };
}
