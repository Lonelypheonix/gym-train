/* GTP service worker: network-first for the page, cache-first for same-origin files,
   stale-while-revalidate for fonts and the Firebase SDK, never cache Firestore calls. */
const CACHE = 'gtp-v2';
const SHELL = ['./gym_training_plan.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;
  if (url.hostname.endsWith('firestore.googleapis.com') || url.hostname.endsWith('firebase.googleapis.com')) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./gym_training_plan.html'))));
    return;
  }

  if (['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'].includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      const net = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => null);
      return cached || net;
    }));
    return;
  }

  e.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
