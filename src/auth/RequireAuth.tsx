import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <main role="status" aria-label="Carregando" className="grid min-h-dvh place-items-center">
        <span className="spinner" />
      </main>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: `${loc.pathname}${loc.search}` }} />;
  }
  return <>{children}</>;
}
