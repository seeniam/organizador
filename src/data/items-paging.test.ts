import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ rows: Array.from({ length: 1005 }, (_, i) => ({ id: `r${i}` })) }));

vi.mock('@/lib/supabase', () => {
  const builder = () => {
    const b = {
      select: () => b,
      order: () => b,
      range: (from: number, to: number) => Promise.resolve({ data: db.rows.slice(from, to + 1), error: null }),
    };
    return b;
  };
  return { supabase: { from: () => builder() } };
});

import { fetchAllItems } from './items';

describe('fetchAllItems', () => {
  it('busca em páginas até trazer todos os itens (além do limite de 1000 da API)', async () => {
    const all = await fetchAllItems();
    expect(all).toHaveLength(1005);
    expect(all[1004]).toEqual({ id: 'r1004' });
  });
});
