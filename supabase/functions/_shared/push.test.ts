import { assertEquals } from 'jsr:@std/assert@1';
import { buildReminderPayload, sendToUser, type ReminderItem, type SubscriptionRow } from './push.ts';

const base: ReminderItem = {
  id: 'abc',
  user_id: 'u1',
  title: 'Dentista',
  category: 'work',
  starts_at: '2026-12-01T17:30:00.000Z',
  all_day: false,
  timezone: 'America/Sao_Paulo',
};

Deno.test('payload com hora, formatado no fuso do item', () => {
  assertEquals(buildReminderPayload(base), {
    title: 'Dentista',
    body: '01/12 às 14:30 · Profissional',
    itemId: 'abc',
    url: '/?item=abc',
    tag: 'item-abc',
  });
});

Deno.test('payload de dia inteiro', () => {
  const p = buildReminderPayload({ ...base, category: 'leisure', all_day: true, starts_at: '2026-12-01T03:00:00.000Z' });
  assertEquals(p.body, '01/12 · Lazer');
});

function fakeAdmin(subs: SubscriptionRow[]) {
  const deleted: string[] = [];
  const admin = {
    from(_table: string) {
      return {
        select: () => ({ eq: (_c: string, _v: string) => Promise.resolve({ data: subs, error: null }) }),
        delete: () => ({
          eq: (_c: string, v: string) => {
            deleted.push(v);
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  };
  return { admin, deleted };
}

Deno.test('inscrição expirada (410) é apagada e as outras continuam recebendo', async () => {
  const subs: SubscriptionRow[] = [
    { endpoint: 'https://push/velha', p256dh: 'a', auth: 'b' },
    { endpoint: 'https://push/boa', p256dh: 'c', auth: 'd' },
  ];
  const { admin, deleted } = fakeAdmin(subs);
  const sentTo: string[] = [];
  const send = (s: SubscriptionRow) => {
    if (s.endpoint.endsWith('velha')) return Promise.reject(Object.assign(new Error('gone'), { statusCode: 410 }));
    sentTo.push(s.endpoint);
    return Promise.resolve();
  };
  const r = await sendToUser(admin as never, 'u1', buildReminderPayload(base), send);
  assertEquals(r, { sent: 1, removed: 1 });
  assertEquals(deleted, ['https://push/velha']);
  assertEquals(sentTo, ['https://push/boa']);
});

Deno.test('erro temporário (500) não apaga a inscrição', async () => {
  const { admin, deleted } = fakeAdmin([{ endpoint: 'https://push/x', p256dh: 'a', auth: 'b' }]);
  const send = () => Promise.reject(Object.assign(new Error('boom'), { statusCode: 500 }));
  const r = await sendToUser(admin as never, 'u1', buildReminderPayload(base), send);
  assertEquals(r, { sent: 0, removed: 0 });
  assertEquals(deleted, []);
});
