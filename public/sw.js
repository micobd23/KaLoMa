const CACHE = 'kaloma-v2';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Only handle our own static GET requests. Supabase/Open Food Facts calls and
  // any non-GET requests (POST/PUT/DELETE) pass straight through to the network,
  // so we never try (and fail) to cache them or serve them stale.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Network-first: always try fresh, cache a copy, fall back to cache when offline.
  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('/index.html')))
  );
});
