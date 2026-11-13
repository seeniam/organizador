import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as auth from '@/auth/AuthProvider';
import Login from './Login';

describe('Login', () => {
  it('botão "Entrar com Google" chama signInWithGoogle e há link de privacidade', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(auth, 'useAuth').mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signInWithGoogle,
      signOut: vi.fn(),
    });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));
    expect(signInWithGoogle).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade');
  });
});
