import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const p = vi.hoisted(() => ({
  support: 'supported' as 'supported' | 'unsupported' | 'ios-needs-install',
  subscribed: false,
  subscribeDevice: vi.fn(),
}));
vi.mock('@/lib/push', () => ({
  pushSupport: () => p.support,
  isDeviceSubscribed: () => Promise.resolve(p.subscribed),
  subscribeDevice: p.subscribeDevice,
}));

import { EnableRemindersCard } from './EnableRemindersCard';

beforeEach(() => {
  localStorage.clear();
  p.support = 'supported';
  p.subscribed = false;
  p.subscribeDevice.mockReset();
});

describe('EnableRemindersCard', () => {
  it('no iPhone sem instalar, mostra instruções e nenhum botão', async () => {
    p.support = 'ios-needs-install';
    render(<EnableRemindersCard />);
    expect(
      await screen.findByText(
        'Para receber lembretes no iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ativar lembretes' })).toBeNull();
  });

  it('suportado e não inscrito: botão Ativar lembretes chama subscribeDevice', async () => {
    p.subscribeDevice.mockResolvedValue('granted');
    render(<EnableRemindersCard />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ativar lembretes' }));
    expect(p.subscribeDevice).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ativar lembretes' })).toBeNull());
  });

  it('"Agora não" esconde e lembra a escolha', async () => {
    const { unmount } = render(<EnableRemindersCard />);
    await userEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
    expect(screen.queryByRole('button', { name: 'Ativar lembretes' })).toBeNull();
    expect(localStorage.getItem('organizador-card-lembretes')).toBe('oculto');
    unmount();
    render(<EnableRemindersCard />);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole('button', { name: 'Ativar lembretes' })).toBeNull();
  });

  it('já inscrito não mostra nada', async () => {
    p.subscribed = true;
    const { container } = render(<EnableRemindersCard />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container).toBeEmptyDOMElement();
  });
});
