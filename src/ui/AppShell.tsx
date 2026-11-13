import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { ItemEditor } from '@/editor/ItemEditor';
import { useOnline } from '@/lib/online';
import { Fab } from './Fab';
import { FilterChips } from './FilterChips';
import { BottomNav, SideNav } from './nav';
import { ToastProvider } from './Toast';

export function AppShell() {
  const online = useOnline();
  const { pathname } = useLocation();
  const isSettings = pathname.startsWith('/configuracoes');
  const [params] = useSearchParams();
  const fabDate = pathname === '/calendario' ? (params.get('dia') ?? undefined) : undefined;

  return (
    <ToastProvider>
      <div className="min-h-dvh md:grid md:grid-cols-[84px_1fr] xl:grid-cols-[248px_1fr]">
        <SideNav />
        <div className="min-w-0 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-16">
          {!online && (
            <p role="status" className="bg-ink px-4 py-2 text-center text-sm font-bold text-bg">
              Sem conexão. Mostrando os últimos dados salvos.
            </p>
          )}
          <main className="mx-auto w-full max-w-2xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-8 md:pt-8 xl:max-w-6xl">
            {!isSettings && (
              <div className="mb-6">
                <FilterChips />
              </div>
            )}
            <Outlet />
          </main>
        </div>
        <BottomNav />
        {!isSettings && <Fab date={fabDate} />}
        <ItemEditor />
      </div>
    </ToastProvider>
  );
}
