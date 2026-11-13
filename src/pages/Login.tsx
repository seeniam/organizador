import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

const FROM_KEY = 'organizador-from';

function readFrom(): string {
  try {
    return sessionStorage.getItem(FROM_KEY) || '/';
  } catch {
    return '/';
  }
}

export default function Login() {
  const { session, signInWithGoogle } = useAuth();
  const loc = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) {
    const to = readFrom();
    try {
      sessionStorage.removeItem(FROM_KEY);
    } catch {
      /* sem armazenamento */
    }
    return <Navigate to={to} replace />;
  }

  async function handleClick() {
    setError('');
    setBusy(true);
    try {
      const from = (loc.state as { from?: string } | null)?.from;
      if (from) sessionStorage.setItem(FROM_KEY, from);
    } catch {
      /* sem armazenamento */
    }
    try {
      await signInWithGoogle();
    } catch {
      setError('Não foi possível abrir o login do Google. Verifique sua conexão e tente de novo.');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 pt-16 pb-8">
      <div>
        <div aria-hidden="true" className="mb-10 flex h-3 w-40 overflow-hidden rounded-full">
          <span className="w-3/5 bg-work" />
          <span className="w-2/5 bg-leisure" />
        </div>
        <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-tight">Organizador</h1>
        <p className="mt-4 text-lg text-muted">
          Tarefas e compromissos do trabalho e do lazer num lugar só, com lembretes no celular.
        </p>
      </div>

      <div className="mt-12">
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 py-4 text-lg font-bold text-bg transition active:scale-[0.98] disabled:opacity-60"
        >
          <GoogleMark />
          Entrar com Google
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/privacidade" className="underline underline-offset-4">
            Política de privacidade
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
