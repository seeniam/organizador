/** Lógica do service worker isolada para poder ser testada. */

export interface PushPayload {
  title: string;
  body: string;
  itemId: string | null;
  url: string;
  tag: string;
}

interface WindowClientLike {
  url: string;
  focus(): Promise<unknown>;
  navigate?(url: string): Promise<unknown>;
}

interface ClientsLike {
  matchAll(opts: { type: 'window'; includeUncontrolled: boolean }): Promise<readonly WindowClientLike[]>;
  openWindow(url: string): Promise<unknown>;
}

export function notificationOptions(p: PushPayload) {
  return {
    body: p.body,
    tag: p.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-64.png',
    data: { url: p.url },
  };
}

export function parsePayload(text: string | undefined): PushPayload {
  try {
    const p = JSON.parse(text ?? '') as Partial<PushPayload>;
    return {
      title: p.title || 'Organizador',
      body: p.body ?? '',
      itemId: p.itemId ?? null,
      url: p.url || '/',
      tag: p.tag || 'organizador',
    };
  } catch {
    return { title: 'Organizador', body: text ?? '', itemId: null, url: '/', tag: 'organizador' };
  }
}

export async function handleNotificationClick(url: string, clients: ClientsLike, origin: string): Promise<void> {
  const target = new URL(url, origin).href;
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows.find((c) => c.url.startsWith(origin));
  if (existing) {
    await existing.focus();
    if (existing.navigate) await existing.navigate(target);
    return;
  }
  await clients.openWindow(target);
}
