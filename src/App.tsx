import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, onBeforeSignOut } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { clearPersistedCache, persister, PERSIST_MAX_AGE, queryClient } from '@/data/queryClient';
import Login from '@/pages/Login';
import Privacy from '@/pages/Privacy';
import { AppShell } from '@/ui/AppShell';

const Today = lazy(() => import('@/pages/Today'));
const Upcoming = lazy(() => import('@/pages/Upcoming'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const History = lazy(() => import('@/pages/History'));
const Settings = lazy(() => import('@/pages/Settings'));

onBeforeSignOut(clearPersistedCache);

const fallback = (
  <div role="status" aria-label="Carregando" className="grid place-items-center py-20">
    <span className="spinner" />
  </div>
);

export function AppRoutes() {
  return (
    <Suspense fallback={<main>{fallback}</main>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Today />} />
          <Route path="proximos" element={<Upcoming />} />
          <Route path="calendario" element={<Calendar />} />
          <Route path="historico" element={<History />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
