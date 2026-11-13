import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'organizador-auth',
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

import { AuthProvider, useAuth } from './AuthProvider';

function Probe() {
  const { session, user, loading } = useAuth();
  if (loading) return <p>carregando</p>;
  return <p>{session ? `logado:${user?.id}` : 'deslogado'}</p>;
}

function setOnline(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });
}

afterEach(() => {
  localStorage.clear();
  setOnline(true);
});

describe('AuthProvider offline', () => {
  it('offline com token expirado, usa a sessão guardada em vez de mandar para o login', async () => {
    setOnline(false);
    localStorage.setItem(
      'organizador-auth',
      JSON.stringify({ access_token: 'x', expires_at: 1, user: { id: 'u1', email: 'a@b.c' } }),
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('logado:u1')).toBeInTheDocument());
  });

  it('online sem sessão continua deslogado', async () => {
    localStorage.setItem('organizador-auth', JSON.stringify({ user: { id: 'u1' } }));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('deslogado')).toBeInTheDocument());
  });
});
