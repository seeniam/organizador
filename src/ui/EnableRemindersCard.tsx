import { useEffect, useState } from 'react';
import { isDeviceSubscribed, pushSupport, subscribeDevice } from '@/lib/push';
import { IconBell } from './icons';

const KEY = 'organizador-card-lembretes';

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === 'oculto';
  } catch {
    return false;
  }
}

type State = 'loading' | 'hidden' | 'ask' | 'ios' | 'denied' | 'error';

export function EnableRemindersCard() {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (dismissed()) {
      setState('hidden');
      return;
    }
    const support = pushSupport();
    if (support === 'unsupported') setState('hidden');
    else if (support === 'ios-needs-install') setState('ios');
    else isDeviceSubscribed().then((s) => active && setState(s ? 'hidden' : 'ask'));
    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, 'oculto');
    } catch {
      /* sem armazenamento */
    }
    setState('hidden');
  }

  async function enable() {
    setBusy(true);
    try {
      const r = await subscribeDevice();
      setState(r === 'granted' ? 'hidden' : 'denied');
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' || state === 'hidden') return null;

  return (
    <aside className="mb-8 flex gap-4 rounded-2xl bg-accent/20 p-4 ring-1 ring-accent/50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
        <IconBell width={20} height={20} />
      </span>
      <div className="min-w-0 flex-1">
        {state === 'ios' && (
          <p>Para receber lembretes no iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início.</p>
        )}
        {state === 'ask' && <p className="font-bold">Receba um aviso antes das suas tarefas e compromissos.</p>}
        {state === 'denied' && (
          <p>As notificações estão bloqueadas. Libere nas configurações do navegador para receber lembretes.</p>
        )}
        {state === 'error' && <p>Não foi possível ativar os lembretes. Tente de novo em Configurações.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {state === 'ask' && (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="rounded-xl bg-ink px-4 py-2 font-bold text-bg disabled:opacity-50"
            >
              Ativar lembretes
            </button>
          )}
          <button type="button" onClick={dismiss} className="rounded-xl px-3 py-2 font-bold text-muted hover:bg-sunken">
            {state === 'ask' ? 'Agora não' : 'Entendi'}
          </button>
        </div>
      </div>
    </aside>
  );
}
