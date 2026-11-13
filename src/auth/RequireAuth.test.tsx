import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './RequireAuth';
import * as auth from './AuthProvider';

function mockAuth(p: Partial<ReturnType<typeof auth.useAuth>>) {
  vi.spyOn(auth, 'useAuth').mockReturnValue({
    session: null,
    user: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    ...p,
  });
}

function LoginProbe() {
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  return <p>login from={from}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <p>conteúdo protegido</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('mostra carregando sem redirecionar enquanto a sessão carrega', () => {
    mockAuth({ loading: true });
    renderAt('/');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/login from/)).toBeNull();
  });

  it('sem sessão vai para /login guardando a origem com ?item=', () => {
    mockAuth({ session: null });
    renderAt('/?item=abc');
    expect(screen.getByText('login from=/?item=abc')).toBeInTheDocument();
  });

  it('com sessão mostra o conteúdo', () => {
    mockAuth({ session: { user: { id: 'u' } } as never, user: { id: 'u' } as never });
    renderAt('/');
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
  });
});
