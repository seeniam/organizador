import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from '@/auth/AuthProvider';

const m = vi.hoisted(() => ({
  support: 'supported' as string,
  subscribed: true,
  order: [] as string[],
  invoke: vi.fn(),
  unsubscribeDevice: vi.fn(),
  subscribeDevice: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/lib/push', () => ({
  pushSupport: () => m.support,
  isDeviceSubscribed: () => Promise.resolve(m.subscribed),
  subscribeDevice: m.subscribeDevice,
  unsubscribeDevice: m.unsubscribeDevice,
}));
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: m.invoke } } }));
vi.mock('@/ui/Toast', () => ({ useToast: () => ({ show: vi.fn() }) }));

import Settings from './Settings';

function renderSettings() {
  vi.spyOn(auth, 'useAuth').mockReturnValue({
    session: {} as never,
    user: { id: 'u', email: 'ana@exemplo.com', user_metadata: { full_name: 'Ana Souza', avatar_url: 'https://img/ana.png' } } as never,
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: m.signOut,
  });
  return render(
    <MemoryRouter initialEntries={['/configuracoes']}>
      <Routes>
        <Route path="/configuracoes" element={<Settings />} />
        <Route path="/login" element={<p>tela de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  m.support = 'supported';
  m.subscribed = true;
  m.order = [];
  m.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
  m.unsubscribeDevice.mockReset().mockImplementation(async () => void m.order.push('unsubscribe'));
  m.signOut.mockReset().mockImplementation(async () => void m.order.push('signOut'));
});

describe('Configurações', () => {
  it('mostra nome, e-mail e foto', () => {
    renderSettings();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('ana@exemplo.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto de Ana Souza' })).toHaveAttribute('src', 'https://img/ana.png');
  });

  it('status dos lembretes', async () => {
    renderSettings();
    expect(await screen.findByText('Lembretes ativos neste dispositivo')).toBeInTheDocument();
  });

  it('status quando desativado', async () => {
    m.subscribed = false;
    renderSettings();
    expect(await screen.findByText('Lembretes desativados neste dispositivo')).toBeInTheDocument();
  });

  it('status quando não suportado', async () => {
    m.support = 'unsupported';
    renderSettings();
    expect(await screen.findByText('Este navegador não suporta notificações')).toBeInTheDocument();
  });

  it('enviar notificação de teste chama a função', async () => {
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar notificação de teste' }));
    expect(m.invoke).toHaveBeenCalledWith('send-test-push');
  });

  it('desativar neste dispositivo', async () => {
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar neste dispositivo' }));
    expect(m.unsubscribeDevice).toHaveBeenCalled();
  });

  it('sair chama signOut (que cancela o push antes)', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(m.signOut).toHaveBeenCalled();
  });

  it('excluir conta exige digitar EXCLUIR e depois sai', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir conta' }));
    const confirm = screen.getByRole('button', { name: 'Excluir definitivamente' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(m.invoke).toHaveBeenCalledWith('delete-account');
    await waitFor(() => expect(m.signOut).toHaveBeenCalled());
    expect(await screen.findByText('tela de login')).toBeInTheDocument();
  });
});
