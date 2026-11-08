// Minimal service worker so every browser treats Music Library as installable.
// Network first for this site's own files, with the last good copy as an
// offline fallback. Firebase, Spotify and artwork requests are left alone.
// Every file is revalidated with GitHub Pages on each load (cache: 'no-cache',
// a quick 304 when nothing changed), so a new version shows up straight away
// without ?v= numbers on the file names.
const CACHE = 'music-library-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Only clear our own old caches: the weekly shop shares this github.io origin.
    for (const key of await caches.keys()) if (key.startsWith('music-library-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req.url, { cache: 'no-cache' });
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (e) {
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      throw e;
    }
  })());
});

// Notifications (sent by functions/index.js through Firebase Cloud Messaging
// when a friend recommends an album). Always shows one: iPhones drop
// subscriptions that receive pushes without a notification.
self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data?.json() || {}; } catch {}
  const d = msg.data || msg.notification || msg;
  event.waitUntil(self.registration.showNotification(d.title || 'Music Library', {
    body: d.body || 'A friend recommended an album',
    icon: d.icon || 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag || 'rec',
    data: { url: d.url || self.registration.scope },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || self.registration.scope, self.registration.scope).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = open.find((c) => c.url.startsWith(self.registration.scope));
    if (client) {
      await client.focus();
      client.postMessage({ open: url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
