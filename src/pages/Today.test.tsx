import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { makeItem } from '@/test/fixtures';
import type { Item } from '@/lib/types';

const data = vi.hoisted(() => ({ items: [] as Item[] }));
vi.mock('@/data/items', () => ({
  useItems: () => ({ data: data.items, isPending: false, isError: false }),
  useToggleDone: () => ({ mutate: vi.fn() }),
  useDeleteItem: () => ({ mutate: vi.fn() }),
  useCreateItem: () => ({ mutate: vi.fn() }),
  friendlyError: () => '',
}));
vi.mock('@/ui/EnableRemindersCard', () => ({ EnableRemindersCard: () => null }));

import Today from './Today';

const NOW = new Date('2026-12-01T15:00:00-03:00');
const iso = (s: string) => new Date(s).toISOString();

function renderToday() {
  return render(
    <MemoryRouter>
      <Today now={NOW} tz="America/Sao_Paulo" />
    </MemoryRouter>,
  );
}

describe('Hoje', () => {
  it('mostra Atrasadas, Hoje e Sem data nessa ordem', () => {
    data.items = [
      makeItem({ title: 'Sem data' }),
      makeItem({ title: 'Mais tarde', starts_at: iso('2026-12-01T18:00:00-03:00') }),
      makeItem({ title: 'Atrasada 1', starts_at: iso('2026-11-30T10:00:00-03:00') }),
    ];
    renderToday();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Atrasadas', 'Hoje', 'Sem data']);
    const hoje = screen.getByRole('region', { name: 'Hoje' });
    expect(within(hoje).getByText('Mais tarde')).toBeInTheDocument();
  });

  it('omite seções vazias', () => {
    data.items = [makeItem({ title: 'Mais tarde', starts_at: iso('2026-12-01T18:00:00-03:00') })];
    renderToday();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Hoje']);
  });

  it('estado vazio', () => {
    data.items = [];
    renderToday();
    expect(screen.getByText('Nada para hoje')).toBeInTheDocument();
  });
});
