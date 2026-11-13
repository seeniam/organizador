import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeItem } from '@/test/fixtures';

const online = vi.hoisted(() => ({ value: true }));
vi.mock('@/lib/online', () => ({ useOnline: () => online.value }));

import { ItemRow } from './ItemRow';

const NOW = new Date('2026-12-01T15:00:00-03:00');
const TZ = 'America/Sao_Paulo';

function renderRow(item = makeItem(), onToggle = vi.fn()) {
  render(
    <MemoryRouter>
      <ul>
        <ItemRow item={item} now={NOW} tz={TZ} onToggle={onToggle} onDelete={vi.fn()} />
      </ul>
    </MemoryRouter>,
  );
  return onToggle;
}

beforeEach(() => {
  online.value = true;
});

describe('ItemRow', () => {
  it('tarefa tem checkbox de concluir que chama onToggle', async () => {
    const onToggle = renderRow(makeItem({ title: 'Relatório' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Concluir Relatório' }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('compromisso não tem checkbox', () => {
    renderRow(makeItem({ kind: 'event', starts_at: new Date('2026-12-01T18:00:00-03:00').toISOString() }));
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('compromisso que já passou fica marcado como passado', () => {
    renderRow(makeItem({ kind: 'event', title: 'Reunião', starts_at: new Date('2026-12-01T09:00:00-03:00').toISOString() }));
    expect(screen.getByRole('listitem')).toHaveAttribute('data-past', 'true');
  });

  it('tarefa atrasada mostra "Atrasada"', () => {
    renderRow(makeItem({ starts_at: new Date('2026-12-01T10:00:00-03:00').toISOString() }));
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
  });

  it('mostra a categoria', () => {
    renderRow(makeItem({ category: 'leisure' }));
    expect(screen.getByText('Lazer')).toBeInTheDocument();
  });

  it('offline o checkbox fica desabilitado', () => {
    online.value = false;
    renderRow(makeItem({ title: 'X' }));
    expect(screen.getByRole('checkbox', { name: 'Concluir X' })).toBeDisabled();
  });
});

describe('ItemRow – horário do compromisso', () => {
  it('mostra o início na lateral e só o fim no detalhe', () => {
    renderRow(
      makeItem({
        kind: 'event',
        starts_at: new Date('2026-12-01T18:00:00-03:00').toISOString(),
        ends_at: new Date('2026-12-01T19:30:00-03:00').toISOString(),
      }),
    );
    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.getByText('até 19:30')).toBeInTheDocument();
    expect(screen.queryByText('18:00–19:30')).toBeNull();
  });
});
