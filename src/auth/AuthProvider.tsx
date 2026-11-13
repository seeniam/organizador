import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AUTH_STORAGE_KEY, supabase } from '@/lib/supabase';

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

type SignOutHook = () => Promise<void> | void;
const beforeSignOut = new Set<SignOutHook>();

/** Registra uma ação a executar antes de sair (ex.: cancelar push, limpar cache). */
export function onBeforeSignOut(fn: SignOutHook): () => void {
  beforeSignOut.add(fn);
  return () => beforeSignOut.delete(fn);
}

function storedSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const s = raw ? (JSON.parse(raw) as Session) : null;
    return s?.user?.id ? s : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () =>
      supabase.auth.getSession().then(({ data }) => {
        // Offline com o token vencido, a renovação falha e a sessão vem nula.
        // Nesse caso usamos a sessão guardada para mostrar os dados em cache.
        if (active) setSession(data.session ?? (navigator.onLine ? null : storedSession()));
      });
    const onOnline = () => void load();
    window.addEventListener('online', onOnline);
    load()
      .finally(() => {
        if (active) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? (navigator.onLine ? null : storedSession()));
      setLoading(false);
    });
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/login` },
        });
        if (error) throw error;
      },
      async signOut() {
        for (const fn of beforeSignOut) {
          try {
            await fn();
          } catch {
            // falhas de rede não impedem a saída
          }
        }
        await supabase.auth.signOut({ scope: 'local' });
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
