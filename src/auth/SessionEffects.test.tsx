import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from './AuthProvider';

const m = vi.hoisted(() => ({ sync: vi.fn(), clear: vi.fn() }));
vi.mock('@/lib/push', () => ({ syncDeviceSubscription: m.sync }));
vi.mock('@/data/queryClient', () => ({ clearPersistedCache: m.clear }));

import { SessionEffects } from './SessionEffects';

function as(userId: string | null) {
  vi.spyOn(auth, 'useAuth').mockReturnValue({
    session: userId ? ({} as never) : null,
    user: userId ? ({ id: userId } as never) : null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  });
}

beforeEach(() => {
  localStorage.clear();
  m.sync.mockReset().mockResolvedValue(true);
  m.clear.mockReset();
});

describe('SessionEffects', () => {
  it('ao entrar, reconcilia a inscrição de push deste aparelho', async () => {
    as('u1');
    render(<SessionEffects />);
    await waitFor(() => expect(m.sync).toHaveBeenCalledOnce());
  });

  it('se outra conta entrar neste aparelho, limpa o cache da anterior', async () => {
    localStorage.setItem('organizador-ultimo-usuario', 'u1');
    as('u2');
    render(<SessionEffects />);
    await waitFor(() => expect(m.clear).toHaveBeenCalledOnce());
    expect(localStorage.getItem('organizador-ultimo-usuario')).toBe('u2');
  });

  it('mesma conta não limpa o cache', async () => {
    localStorage.setItem('organizador-ultimo-usuario', 'u1');
    as('u1');
    render(<SessionEffects />);
    await waitFor(() => expect(m.sync).toHaveBeenCalled());
    expect(m.clear).not.toHaveBeenCalled();
  });

  it('sem sessão não faz nada', () => {
    as(null);
    render(<SessionEffects />);
    expect(m.sync).not.toHaveBeenCalled();
  });
});
