/**
 * Página de demonstração só para desenvolvimento (npm run dev → /demo.html).
 * Mostra o app com uma sessão falsa e itens de exemplo, sem precisar do Supabase.
 * Não entra no build de produção.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@/index.css';
import { AuthContext, type AuthState } from '@/auth/AuthProvider';
import { ITEMS_KEY } from '@/data/items';
import { dayOf, deviceTimeZone } from '@/lib/dates';
import type { Item } from '@/lib/types';
import { AppShell } from '@/ui/AppShell';

const Today = lazy(() => import('@/pages/Today'));
const Upcoming = lazy(() => import('@/pages/Upcoming'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const History = lazy(() => import('@/pages/History'));
const Settings = lazy(() => import('@/pages/Settings'));

const tz = deviceTimeZone();
const now = new Date();
const today = dayOf(now, tz);
const at = (dayOffset: number, h: number, m = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const allDay = (dayOffset: number) => at(dayOffset, 0);

let n = 0;
const it = (p: Partial<Item>): Item => ({
  id: `demo-${++n}`,
  user_id: 'demo',
  kind: 'task',
  category: 'work',
  title: 'Item',
  notes: null,
  starts_at: null,
  ends_at: null,
  all_day: false,
  timezone: tz,
  reminder_minutes: null,
  remind_at: null,
  reminder_sent_at: null,
  done_at: null,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  ...p,
});

const items: Item[] = [
  it({ title: 'Enviar proposta para o cliente', starts_at: at(-1, 17), reminder_minutes: 60 }),
  it({ kind: 'event', title: 'Daily com o time', starts_at: at(0, 9, 30), ends_at: at(0, 9, 45) }),
  it({ title: 'Revisar contrato', starts_at: at(0, 14), reminder_minutes: 10 }),
  it({ kind: 'event', category: 'leisure', title: 'Futebol com a turma', starts_at: at(0, 19), ends_at: at(0, 21), reminder_minutes: 60 }),
  it({ category: 'leisure', title: 'Comprar presente da Lia', starts_at: allDay(0), all_day: true }),
  it({ category: 'leisure', title: 'Ler o livro do clube' }),
  it({ title: 'Organizar notas fiscais' }),
  it({ kind: 'event', title: 'Apresentação trimestral', starts_at: at(1, 10), ends_at: at(1, 11, 30), reminder_minutes: 1440 }),
  it({ kind: 'event', category: 'leisure', title: 'Cinema', starts_at: at(1, 20, 15) }),
  it({ category: 'leisure', title: 'Marcar dentista', starts_at: allDay(3), all_day: true }),
  it({ kind: 'event', category: 'leisure', title: 'Aniversário da mãe', starts_at: allDay(5), all_day: true }),
  it({ title: 'Fechar relatório mensal', starts_at: at(6, 18) }),
  it({ title: 'Atualizar planilha', starts_at: at(-2, 10), done_at: at(-2, 11) }),
  it({ kind: 'event', title: 'Reunião com fornecedor', starts_at: at(-3, 15), ends_at: at(-3, 16) }),
];

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
qc.setQueryData(ITEMS_KEY, items);

const auth: AuthState = {
  session: {} as never,
  user: { id: 'demo', email: 'ana@exemplo.com', user_metadata: { full_name: 'Ana Souza' } } as never,
  loading: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
};

const start = new URLSearchParams(location.search).get('rota') ?? '/';
console.info('Demo', today, tz);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[start]}>
          <Suspense fallback={null}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<Today />} />
                <Route path="proximos" element={<Upcoming />} />
                <Route path="calendario" element={<Calendar />} />
                <Route path="historico" element={<History />} />
                <Route path="configuracoes" element={<Settings />} />
              </Route>
            </Routes>
          </Suspense>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
);
