const CACHE_NAME = 'tomo-shell-v1.0.1-auth1';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=1.0.1',
  './app.js?v=1.0.1',
  './auth/anilist-config.js?v=1.0.1',
  './auth/anilist-auth.js?v=1.0.1',
  './auth/anilist-auth.css?v=1.0.1',
  './manifest.json?v=1.0.1',
  './icons/icon-192.png?v=1.0.1',
  './icons/icon.svg?v=1.0.1',
  './icons/icon-maskable.svg?v=1.0.1'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.endsWith('anilist.co')) return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
