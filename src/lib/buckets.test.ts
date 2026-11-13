import { describe, expect, it } from 'vitest';
import { bucketize, daysWithItems, filterByCategory, isEventPast, itemsOnDay } from './buckets';
import { itemDay } from './dates';
import type { Item } from './types';

const TZ = 'America/Sao_Paulo';
const NOW = new Date('2026-12-01T15:00:00-03:00');

let seq = 0;
function item(p: Partial<Item>): Item {
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
    timezone: TZ,
    reminder_minutes: null,
    remind_at: null,
    reminder_sent_at: null,
    done_at: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...p,
  };
}
const iso = (s: string) => new Date(s).toISOString();

describe('bucketize', () => {
  it('tarefa concluída vai para o histórico no dia da conclusão', () => {
    const t = item({ done_at: iso('2026-11-30T10:00:00-03:00'), starts_at: iso('2026-12-05T10:00:00-03:00') });
    const b = bucketize([t], NOW, TZ);
    expect(b.history[0].day).toBe('2026-11-30');
    expect(b.history[0].items).toEqual([t]);
  });

  it('tarefa pendente sem data vai para "Sem data"', () => {
    const t = item({});
    expect(bucketize([t], NOW, TZ).noDate).toEqual([t]);
  });

  it('classifica tarefas pendentes com data', () => {
    const passouHora = item({ starts_at: iso('2026-12-01T10:00:00-03:00') });
    const maisTarde = item({ starts_at: iso('2026-12-01T18:00:00-03:00') });
    const ontemDiaInteiro = item({ starts_at: iso('2026-11-29T00:00:00-03:00'), all_day: true });
    const hojeDiaInteiro = item({ starts_at: iso('2026-12-01T00:00:00-03:00'), all_day: true });
    const futura = item({ starts_at: iso('2026-12-03T09:00:00-03:00') });
    const b = bucketize([passouHora, maisTarde, ontemDiaInteiro, hojeDiaInteiro, futura], NOW, TZ);
    expect(b.overdue.map((i) => i.id).sort()).toEqual([passouHora.id, ontemDiaInteiro.id].sort());
    expect(b.today.map((i) => i.id)).toEqual([hojeDiaInteiro.id, maisTarde.id]);
    expect(b.upcoming).toEqual([{ day: '2026-12-03', items: [futura] }]);
  });

  it('compromisso de hoje que já passou fica em Hoje, nunca atrasado', () => {
    const e = item({
      kind: 'event',
      starts_at: iso('2026-12-01T09:00:00-03:00'),
      ends_at: iso('2026-12-01T10:00:00-03:00'),
    });
    const b = bucketize([e], NOW, TZ);
    expect(b.today).toEqual([e]);
    expect(b.overdue).toEqual([]);
    expect(isEventPast(e, NOW)).toBe(true);
  });

  it('compromisso de ontem vai para o histórico', () => {
    const e = item({ kind: 'event', starts_at: iso('2026-11-30T09:00:00-03:00') });
    const b = bucketize([e], NOW, TZ);
    expect(b.history).toEqual([{ day: '2026-11-30', items: [e] }]);
    expect(b.overdue).toEqual([]);
  });

  it('compromisso que atravessa o dia de hoje aparece em Hoje', () => {
    const e = item({
      kind: 'event',
      starts_at: iso('2026-11-30T20:00:00-03:00'),
      ends_at: iso('2026-12-02T10:00:00-03:00'),
    });
    expect(bucketize([e], NOW, TZ).today).toEqual([e]);
  });

  it('ordena próximos em ordem crescente e histórico em ordem decrescente', () => {
    const d5 = item({ starts_at: iso('2026-12-05T09:00:00-03:00') });
    const d3 = item({ starts_at: iso('2026-12-03T09:00:00-03:00') });
    const h1 = item({ kind: 'event', starts_at: iso('2026-11-20T09:00:00-03:00') });
    const h2 = item({ kind: 'event', starts_at: iso('2026-11-28T09:00:00-03:00') });
    const b = bucketize([d5, d3, h1, h2], NOW, TZ);
    expect(b.upcoming.map((g) => g.day)).toEqual(['2026-12-03', '2026-12-05']);
    expect(b.history.map((g) => g.day)).toEqual(['2026-11-28', '2026-11-20']);
  });
});

describe('itemDay', () => {
  it('dia inteiro usa o fuso do item, mesmo visto de outro fuso', () => {
    const t = item({ all_day: true, timezone: TZ, starts_at: '2026-12-01T03:00:00.000Z' });
    expect(itemDay(t, 'Asia/Tokyo')).toBe('2026-12-01');
  });

  it('item com hora usa o fuso do visualizador', () => {
    const t = item({ starts_at: '2026-12-01T23:30:00.000Z' });
    expect(itemDay(t, TZ)).toBe('2026-12-01');
    expect(itemDay(t, 'Asia/Tokyo')).toBe('2026-12-02');
  });
});

describe('filtros e calendário', () => {
  it('filterByCategory', () => {
    const w = item({ category: 'work' });
    const l = item({ category: 'leisure' });
    expect(filterByCategory([w, l], 'work')).toEqual([w]);
    expect(filterByCategory([w, l], 'all')).toEqual([w, l]);
  });

  it('daysWithItems lista as categorias distintas de cada dia do mês', () => {
    const a = item({ category: 'work', starts_at: iso('2026-12-01T09:00:00-03:00') });
    const b = item({ category: 'leisure', kind: 'event', starts_at: iso('2026-12-01T19:00:00-03:00') });
    const c = item({ category: 'work', starts_at: iso('2026-12-01T20:00:00-03:00') });
    const fora = item({ category: 'work', starts_at: iso('2027-01-01T20:00:00-03:00') });
    const m = daysWithItems([a, b, c, fora], '2026-12', TZ);
    expect(m.get('2026-12-01')?.sort()).toEqual(['leisure', 'work']);
    expect(m.has('2027-01-01')).toBe(false);
  });

  it('itemsOnDay inclui itens passados e concluídos daquele dia', () => {
    const feito = item({ starts_at: iso('2026-11-30T09:00:00-03:00'), done_at: iso('2026-11-30T10:00:00-03:00') });
    const outro = item({ starts_at: iso('2026-11-29T09:00:00-03:00') });
    expect(itemsOnDay([feito, outro], '2026-11-30', TZ)).toEqual([feito]);
  });
});
