import type { Item } from '@/lib/types';

let seq = 0;

export function makeItem(p: Partial<Item> = {}): Item {
  seq += 1;
  return {
    id: `id-${seq}`,
    user_id: 'u',
    kind: 'task',
    category: 'work',
    title: `Item ${seq}`,
    notes: null,
    starts_at: null,
    ends_at: null,
    all_day: false,
    timezone: 'America/Sao_Paulo',
    reminder_minutes: null,
    remind_at: null,
    reminder_sent_at: null,
    done_at: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...p,
  };
}
