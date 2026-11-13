import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import Login from '@/pages/Login';
import Privacy from '@/pages/Privacy';

function Placeholder({ title }: { title: string }) {
  return <h1 className="p-6 font-display text-3xl">{title}</h1>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacidade" element={<Privacy />} />
      <Route
        element={
          <RequireAuth>
            <main>
              <Outlet />
            </main>
          </RequireAuth>
        }
      >
        <Route index element={<Placeholder title="Hoje" />} />
        <Route path="proximos" element={<Placeholder title="Próximos" />} />
        <Route path="calendario" element={<Placeholder title="Calendário" />} />
        <Route path="historico" element={<Placeholder title="Histórico" />} />
        <Route path="configuracoes" element={<Placeholder title="Configurações" />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
