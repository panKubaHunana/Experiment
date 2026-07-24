// Experiment PWA service worker — app-shell cache, local notification click
// routing, and (optionally) real Web Push delivery from server/ so the
// hourly reminder reaches an installed home-screen app even while it's
// closed — the one case js/scheduler.js's foreground-only timers can't cover
// (notably iOS, which suspends background page/SW JS).
//
// This is a classic (non-module) service worker, so it can't `import` from
// js/config.js — keep this in sync with that file by hand.
const PUSH_SERVER_URL = '';

const CACHE = 'experiment-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/config.js',
  './js/storage.js',
  './js/scheduler.js',
  './js/activities.js',
  './js/icons.js',
  './js/stats.js',
  './js/charts.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/badge-72.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || network;
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    }),
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* non-JSON payload, ignore */ }
  const title = data.title || 'Experiment — čas zapsat činnost';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Co právě děláte?',
      tag: data.tag || 'hourly',
      icon: './icons/icon-192.png',
      badge: './icons/badge-72.png',
      data,
    }),
  );
});

// Fires rarely (browser-rotated subscription). Best-effort re-subscribe so
// the study doesn't silently lose push delivery mid-week.
self.addEventListener('pushsubscriptionchange', event => {
  if (!PUSH_SERVER_URL || !event.oldSubscription) return;
  const oldEndpoint = event.oldSubscription.endpoint;
  const applicationServerKey = event.oldSubscription.options.applicationServerKey;
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      .then(sub => Promise.all([
        fetch(`${PUSH_SERVER_URL}/api/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        }),
        fetch(`${PUSH_SERVER_URL}/api/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: oldEndpoint }),
        }),
      ]))
      .catch(() => {}),
  );
});
