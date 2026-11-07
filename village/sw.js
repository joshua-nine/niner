// Agent Kingdom service worker: always try the network first for the
// kingdom's own files (so the installed app never runs stale code), and fall
// back to the last saved copy when offline. Other sites (Firebase, fonts,
// Google Sheets) are left alone.
const CACHE = 'kingdom-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: 'no-cache' });       // revalidate with the server every time
      if (fresh.ok) { const c = await caches.open(CACHE); c.put(req, fresh.clone()); }
      return fresh;
    } catch {
      const saved = await caches.match(req);
      if (saved) return saved;
      throw new Error('offline and not saved');
    }
  })());
});
