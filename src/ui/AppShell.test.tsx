import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from '@/auth/AuthProvider';

const online = vi.hoisted(() => ({ value: true }));
vi.mock('@/lib/online', () => ({ useOnline: () => online.value }));
vi.mock('@/editor/ItemEditor', () => ({ ItemEditor: () => null }));

import { AppShell } from './AppShell';

function renderShell(path = '/') {
  vi.spyOn(auth, 'useAuth').mockReturnValue({
    session: {} as never,
    user: { id: 'u', user_metadata: { full_name: 'Ana' } } as never,
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  });
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<p>tela hoje</p>} />
            <Route path="proximos" element={<p>tela próximos</p>} />
            <Route path="calendario" element={<p>tela calendário</p>} />
            <Route path="historico" element={<p>tela histórico</p>} />
            <Route path="configuracoes" element={<p>tela configurações</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  online.value = true;
  localStorage.clear();
});

describe('AppShell', () => {
  it('tem os destinos de navegação e marca o ativo', () => {
    renderShell('/proximos');
    for (const name of ['Hoje', 'Próximos', 'Calendário', 'Histórico', 'Configurações']) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
    for (const link of screen.getAllByRole('link', { name: 'Próximos' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
    expect(screen.getAllByRole('link', { name: 'Hoje' })[0]).not.toHaveAttribute('aria-current');
  });

  it('o filtro escolhido continua ao trocar de tela', async () => {
    renderShell('/');
    await userEvent.click(screen.getByRole('button', { name: 'Lazer' }));
    expect(screen.getByRole('button', { name: 'Lazer' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getAllByRole('link', { name: 'Próximos' })[0]);
    expect(screen.getByText('tela próximos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lazer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('offline mostra o aviso e desabilita o botão de criar', () => {
    online.value = false;
    renderShell('/');
    expect(screen.getByText('Sem conexão. Mostrando os últimos dados salvos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar item' })).toBeDisabled();
  });

  it('o botão de criar oferece tarefa e compromisso', async () => {
    renderShell('/');
    await userEvent.click(screen.getByRole('button', { name: 'Criar item' }));
    expect(screen.getByRole('menuitem', { name: 'Nova tarefa' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Novo compromisso' })).toBeInTheDocument();
  });
});
