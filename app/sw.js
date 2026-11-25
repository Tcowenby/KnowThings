// Service worker: app shell works offline; feed is network-first with cached fallback.
const VERSION = 'kt-v5';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.endsWith('/data/feed.json')) {
    const key = new Request(new URL('data/feed.json', self.registration.scope));
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(key, res.clone()));
          return res;
        })
        .catch(() => caches.match(key)),
    );
    return;
  }

  // Shell: stale-while-revalidate so updates land on the next launch.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const net = fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || net;
    }),
  );
});
