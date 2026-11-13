import { supabase } from './supabase';

export type PushSupport = 'unsupported' | 'ios-needs-install' | 'supported';

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

export function pushSupport(): PushSupport {
  if (isIOS() && !isStandalone()) return 'ios-needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  return 'supported';
}

export function urlBase64ToUint8Array(s: string): Uint8Array {
  const padded = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'supported') return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function isDeviceSubscribed(): Promise<boolean> {
  try {
    return Notification.permission === 'granted' && !!(await currentSubscription());
  } catch {
    return false;
  }
}

export async function subscribeDevice(): Promise<'granted' | 'denied'> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key) throw new Error('VITE_VAPID_PUBLIC_KEY ausente');

  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));
  await claim(sub);
  return 'granted';
}

/**
 * Grava (ou transfere com prova de posse) a inscrição deste navegador para a conta atual.
 */
async function claim(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  const { error } = await supabase.rpc('claim_push_subscription', {
    p_endpoint: json.endpoint!,
    p_p256dh: json.keys!.p256dh,
    p_auth: json.keys!.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/**
 * Ao entrar no app: se o navegador já tem inscrição e permissão, garante que ela
 * esteja registrada no servidor para a conta atual. Retorna se havia inscrição.
 */
export async function syncDeviceSubscription(): Promise<boolean> {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return false;
  const sub = await currentSubscription();
  if (!sub) return false;
  await claim(sub);
  return true;
}

export async function unsubscribeDevice(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  } finally {
    await sub.unsubscribe();
  }
}
