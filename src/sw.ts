/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { handleNotificationClick, notificationOptions, parsePayload } from './sw-handlers';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/auth\//, /\.[a-z0-9]+$/i] }));

self.addEventListener('push', (event) => {
  const p = parsePayload(event.data?.text());
  event.waitUntil(self.registration.showNotification(p.title, notificationOptions(p)));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/';
  event.waitUntil(handleNotificationClick(url, self.clients as never, self.location.origin));
});
