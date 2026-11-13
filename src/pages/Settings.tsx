import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { isDeviceSubscribed, pushSupport, subscribeDevice, unsubscribeDevice } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/ui/Toast';

type PushState = 'loading' | 'on' | 'off' | 'unsupported' | 'ios';

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [push, setPush] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const name = (user?.user_metadata?.full_name as string | undefined) ?? 'Sua conta';
  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  useEffect(() => {
    let active = true;
    const s = pushSupport();
    if (s === 'unsupported') setPush('unsupported');
    else if (s === 'ios-needs-install') setPush('ios');
    else isDeviceSubscribed().then((on) => active && setPush(on ? 'on' : 'off'));
    return () => {
      active = false;
    };
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const enable = () =>
    run(async () => {
      try {
        const r = await subscribeDevice();
        setPush(r === 'granted' ? 'on' : 'off');
        if (r === 'denied') toast.show('Notificações bloqueadas. Libere nas configurações do navegador.');
      } catch {
        toast.show('Não foi possível ativar os lembretes.');
      }
    });

  const disable = () =>
    run(async () => {
      try {
        await unsubscribeDevice();
        setPush('off');
        toast.show('Lembretes desativados neste dispositivo');
      } catch {
        toast.show('Não foi possível desativar. Tente de novo.');
      }
    });

  const test = () =>
    run(async () => {
      const { error } = await supabase.functions.invoke('send-test-push');
      toast.show(error ? 'Não foi possível enviar o teste.' : 'Notificação de teste enviada');
    });

  const logout = () =>
    run(async () => {
      await signOut();
      navigate('/login', { replace: true });
    });

  const deleteAccount = () =>
    run(async () => {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) {
        toast.show('Não foi possível excluir a conta. Tente de novo.');
        return;
      }
      await signOut();
      navigate('/login', { replace: true });
    });

  const status: Record<PushState, string> = {
    loading: 'Verificando…',
    on: 'Lembretes ativos neste dispositivo',
    off: 'Lembretes desativados neste dispositivo',
    unsupported: 'Este navegador não suporta notificações',
    ios: 'No iPhone, adicione o app à Tela de Início para receber lembretes',
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight md:text-5xl">Configurações</h1>

      <Card title="Conta">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img src={avatar} alt={`Foto de ${name}`} referrerPolicy="no-referrer" className="h-14 w-14 rounded-full" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-work-soft font-display text-xl font-semibold text-work">
              {name.charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold">{name}</p>
            <p className="truncate text-muted">{user?.email}</p>
          </div>
        </div>
      </Card>

      <Card title="Lembretes">
        <p className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${push === 'on' ? 'bg-leisure' : 'bg-line'}`}
          />
          {status[push]}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {push === 'off' && (
            <Button onClick={enable} disabled={busy} primary>
              Ativar lembretes
            </Button>
          )}
          {push === 'on' && (
            <>
              <Button onClick={test} disabled={busy} primary>
                Enviar notificação de teste
              </Button>
              <Button onClick={disable} disabled={busy}>
                Desativar neste dispositivo
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card title="Sessão">
        <Button onClick={logout} disabled={busy}>
          Sair
        </Button>
      </Card>

      <Card title="Excluir conta">
        <p className="text-muted">
          Apaga sua conta, todos os seus itens e os aparelhos cadastrados para lembretes. Não dá para desfazer.
        </p>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-4 rounded-xl border border-danger px-4 py-2.5 font-bold text-danger"
          >
            Excluir conta
          </button>
        ) : (
          <div className="mt-4">
            <label htmlFor="confirm-delete" className="font-bold">
              Digite EXCLUIR para confirmar
            </label>
            <input
              id="confirm-delete"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-3"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={deleteAccount}
                disabled={typed !== 'EXCLUIR' || busy}
                className="rounded-xl bg-danger px-4 py-2.5 font-bold text-white disabled:opacity-40"
              >
                Excluir definitivamente
              </button>
              <Button
                onClick={async () => {
                  setConfirming(false);
                  setTyped('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-8 text-sm text-muted">
        <Link to="/privacidade" className="underline underline-offset-4">
          Política de privacidade
        </Link>
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-surface p-5">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Button({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  onClick(): Promise<void> | void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'rounded-xl bg-ink px-4 py-2.5 font-bold text-bg disabled:opacity-40'
          : 'rounded-xl border border-line px-4 py-2.5 font-bold disabled:opacity-40'
      }
    >
      {children}
    </button>
  );
}
