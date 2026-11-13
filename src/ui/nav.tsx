import clsx from 'clsx';
import type { ComponentType, SVGProps } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { IconCalendar, IconHistory, IconSettings, IconToday, IconUpcoming } from './icons';

interface Dest {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  end?: boolean;
}

export const DESTINATIONS: Dest[] = [
  { to: '/', label: 'Hoje', Icon: IconToday, end: true },
  { to: '/proximos', label: 'Próximos', Icon: IconUpcoming },
  { to: '/calendario', label: 'Calendário', Icon: IconCalendar },
  { to: '/historico', label: 'Histórico', Icon: IconHistory },
];

const SETTINGS: Dest = { to: '/configuracoes', label: 'Configurações', Icon: IconSettings };

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {[...DESTINATIONS, SETTINGS].map((d) => (
          <li key={d.to}>
            <NavLink
              to={d.to}
              end={d.end}
              aria-label={d.label}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-0.5 px-1 pt-2.5 pb-2 text-[11px] font-bold',
                  isActive ? 'text-ink' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={clsx(
                      'grid h-8 w-14 place-items-center rounded-full transition-colors',
                      isActive && 'bg-accent text-accent-ink',
                    )}
                  >
                    <d.Icon width={22} height={22} />
                  </span>
                  <span className="max-w-full truncate">{d.to === '/configuracoes' ? 'Conta' : d.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const { user } = useAuth();
  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  const link = (d: Dest) => (
    <NavLink
      key={d.to}
      to={d.to}
      end={d.end}
      title={d.label}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold transition-colors md:justify-center xl:justify-start',
          isActive ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-sunken hover:text-ink',
        )
      }
    >
      <d.Icon width={22} height={22} className="shrink-0" />
      <span className="md:sr-only xl:not-sr-only">{d.label}</span>
    </NavLink>
  );

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-surface px-3 py-5 md:flex"
    >
      <div className="mb-6 flex items-center gap-3 px-2 md:justify-center xl:justify-start">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 overflow-hidden rounded-lg">
          <span className="w-3/5 bg-work" />
          <span className="w-2/5 bg-leisure" />
        </span>
        <span className="hidden font-display text-xl font-semibold tracking-tight xl:inline">Organizador</span>
      </div>
      {DESTINATIONS.map(link)}
      <div className="mt-auto">
        <NavLink
          to={SETTINGS.to}
          title={SETTINGS.label}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-xl px-2 py-2 font-bold md:justify-center xl:justify-start',
              isActive ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-sunken hover:text-ink',
            )
          }
        >
          {avatar ? (
            <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full" />
          ) : (
            <SETTINGS.Icon width={22} height={22} className="shrink-0" />
          )}
          <span className="md:sr-only xl:not-sr-only">Configurações</span>
        </NavLink>
      </div>
    </nav>
  );
}
