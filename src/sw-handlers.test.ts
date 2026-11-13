import { describe, expect, it, vi } from 'vitest';
import { handleNotificationClick, notificationOptions, type PushPayload } from './sw-handlers';

const payload: PushPayload = {
  title: 'Dentista',
  body: '01/12 às 14:30 · Lazer',
  itemId: 'abc',
  url: '/?item=abc',
  tag: 'item-abc',
};

describe('notificationOptions', () => {
  it('monta as opções da notificação', () => {
    expect(notificationOptions(payload)).toMatchObject({
      body: payload.body,
      tag: 'item-abc',
      icon: '/icons/icon-192.png',
      data: { url: '/?item=abc' },
    });
  });
});

describe('handleNotificationClick', () => {
  it('foca a aba já aberta e navega até o item, sem abrir janela nova', async () => {
    const client = { url: 'https://app.test/proximos', focus: vi.fn().mockResolvedValue(undefined), navigate: vi.fn().mockResolvedValue(undefined) };
    const clients = { matchAll: vi.fn().mockResolvedValue([client]), openWindow: vi.fn() };
    await handleNotificationClick('/?item=abc', clients as never, 'https://app.test');
    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith('https://app.test/?item=abc');
    expect(clients.openWindow).not.toHaveBeenCalled();
  });

  it('sem aba aberta, abre uma janela', async () => {
    const clients = { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn().mockResolvedValue(null) };
    await handleNotificationClick('/?item=abc', clients as never, 'https://app.test');
    expect(clients.openWindow).toHaveBeenCalledWith('https://app.test/?item=abc');
  });
});
