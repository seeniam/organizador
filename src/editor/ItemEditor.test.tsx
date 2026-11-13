import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeItem } from '@/test/fixtures';
import type { Item } from '@/lib/types';

const m = vi.hoisted(() => ({
  online: true,
  items: [] as Item[],
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/lib/online', () => ({ useOnline: () => m.online }));
vi.mock('@/lib/dates', async (orig) => ({
  ...(await orig<typeof import('@/lib/dates')>()),
  deviceTimeZone: () => 'America/Sao_Paulo',
}));
vi.mock('@/data/items', () => ({
  useItems: () => ({ data: m.items, isPending: false }),
  useCreateItem: () => ({ mutate: m.create, isPending: false }),
  useUpdateItem: () => ({ mutate: m.update, isPending: false }),
  useDeleteItem: () => ({ mutate: m.remove }),
  useToggleDone: () => ({ mutate: vi.fn() }),
  friendlyError: () => 'erro',
}));
vi.mock('@/ui/Toast', () => ({ useToast: () => ({ show: m.toast }) }));

import { ItemEditor } from './ItemEditor';

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <ItemEditor />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  m.online = true;
  m.items = [];
  m.create.mockReset();
  m.update.mockReset();
  m.remove.mockReset();
  m.toast.mockReset();
});

describe('ItemEditor', () => {
  it('fica fechado sem parâmetros na URL', () => {
    renderAt('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('compromisso mostra Hora de fim e Dia inteiro', async () => {
    renderAt('?novo=task');
    expect(screen.queryByLabelText('Hora de fim')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Compromisso' }));
    expect(screen.getByLabelText('Hora de fim')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Dia inteiro' })).toBeInTheDocument();
  });

  it('título vazio mostra erro e não salva', async () => {
    renderAt('?novo=task');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Informe um título')).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
  });

  it('formulário válido cria o item convertido', async () => {
    renderAt('?novo=event&data=2026-12-01');
    await userEvent.type(screen.getByLabelText('Título'), 'Dentista');
    await userEvent.type(screen.getByLabelText('Hora'), '14:30');
    await userEvent.click(screen.getByRole('radio', { name: 'Lazer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(m.create).toHaveBeenCalledOnce();
    expect(m.create.mock.calls[0][0]).toMatchObject({
      kind: 'event',
      category: 'leisure',
      title: 'Dentista',
      starts_at: '2026-12-01T17:30:00.000Z',
      timezone: 'America/Sao_Paulo',
    });
  });

  it('offline o botão Salvar fica desabilitado', () => {
    m.online = false;
    renderAt('?novo=task');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('editar salva com o fuso do próprio item', async () => {
    m.items = [makeItem({ id: 'x', title: 'Viagem', timezone: 'Europe/Lisbon', starts_at: '2026-12-01T10:00:00.000Z' })];
    renderAt('?item=x');
    expect(screen.getByLabelText('Título')).toHaveValue('Viagem');
    expect(screen.getByLabelText('Hora')).toHaveValue('10:00');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(m.update.mock.calls[0][0]).toMatchObject({
      id: 'x',
      patch: { starts_at: '2026-12-01T10:00:00.000Z', timezone: 'Europe/Lisbon' },
    });
  });

  it('excluir mostra toast com Desfazer que recria o item', async () => {
    const item = makeItem({ id: 'x', title: 'Apagar' });
    m.items = [item];
    m.remove.mockImplementation((_id, opts) => opts?.onSuccess?.());
    renderAt('?item=x');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(m.remove.mock.calls[0][0]).toBe('x');
    expect(m.toast).toHaveBeenCalledWith('Item excluído', expect.objectContaining({ label: 'Desfazer' }));
    m.toast.mock.calls[0][1].onClick();
    expect(m.create.mock.calls[0][0]).toMatchObject({ title: 'Apagar', kind: 'task', category: 'work' });
  });

  it('item desconhecido avisa e fecha', () => {
    renderAt('?item=nao-existe');
    expect(m.toast).toHaveBeenCalledWith('Item não encontrado');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
