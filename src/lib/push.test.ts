import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn().mockResolvedValue({ error: null });
const del = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert,
      delete: () => ({ eq: (...a: unknown[]) => (del(...a), Promise.resolve({ error: null })) }),
    }),
  },
}));

import { pushSupport, subscribeDevice, urlBase64ToUint8Array } from './push';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';

function setEnv({ ua, standalone = false, push = true }: { ua: string; standalone?: boolean; push?: boolean }) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true });
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
  if (push) (window as unknown as Record<string, unknown>).PushManager = function () {};
  else delete (window as unknown as Record<string, unknown>).PushManager;
  (window as unknown as Record<string, unknown>).Notification = { permission: 'default', requestPermission: vi.fn() };
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
}

beforeEach(() => {
  upsert.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe('pushSupport', () => {
  it('iPhone fora da tela inicial precisa instalar', () => {
    setEnv({ ua: IPHONE, standalone: false, push: false });
    expect(pushSupport()).toBe('ios-needs-install');
  });
  it('iPhone instalado é suportado', () => {
    setEnv({ ua: IPHONE, standalone: true });
    expect(pushSupport()).toBe('supported');
  });
  it('sem PushManager não é suportado', () => {
    setEnv({ ua: ANDROID, push: false });
    expect(pushSupport()).toBe('unsupported');
  });
  it('Android com PushManager é suportado', () => {
    setEnv({ ua: ANDROID });
    expect(pushSupport()).toBe('supported');
  });
});

describe('subscribeDevice', () => {
  it('permissão negada não grava nada', async () => {
    setEnv({ ua: ANDROID });
    (Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied');
    expect(await subscribeDevice()).toBe('denied');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('permissão concedida inscreve e grava com onConflict endpoint', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BAAA');
    setEnv({ ua: ANDROID });
    (Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push.test/1', keys: { p256dh: 'P', auth: 'A' } }),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe } }) },
      configurable: true,
    });
    expect(await subscribeDevice()).toBe('granted');
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) });
    expect(upsert).toHaveBeenCalledWith(
      { endpoint: 'https://push.test/1', p256dh: 'P', auth: 'A', user_agent: ANDROID },
      { onConflict: 'endpoint' },
    );
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64 url-safe', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toEqual([1, 2, 3, 255, 239]);
  });
});
