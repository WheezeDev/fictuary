// Keeps the app's own screens on the phone so it opens with no internet.
// Stories are not here; they are in the phone's database (see store.js).
// Change VERSION whenever the app's files change, so phones pick up the new version.
const VERSION = 'v2';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'ao3.js', 'store.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Use the saved copy straight away, and quietly fetch a fresh one for next time.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const saved = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => saved);
    return saved || fresh;
  }));
});
