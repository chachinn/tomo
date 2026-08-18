const CACHE_NAME = 'tomo-shell-v1.2.2-tune-sheet-layer';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=1.0.2',
  './navigation/tomo-nav.css?v=1.1.3',
  './app.js?v=1.1.3',
  './navigation/tomo-nav.js?v=1.2.1',
  './randomizer/tomo-randomizer-filters.css?v=1.2.2',
  './randomizer/tomo-randomizer-filters.js?v=1.2.0',
  './library/tomo-library.css?v=1.1.1',
  './library/tomo-library.js?v=1.1.1',
  './library/tomo-library-sync.css?v=1.1.2',
  './library/tomo-library-sync.js?v=1.1.2',
  './auth/anilist-config.js?v=1.0.2',
  './auth/anilist-auth.js?v=1.1.3',
  './auth/anilist-auth.css?v=1.0.2',
  './manifest.json?v=1.0.2',
  './icons/apple-touch-icon.png?v=1.0.3',
  './icons/icon-192.png?v=1.0.2',
  './icons/icon-512.png?v=1.0.2',
  './icons/maskable-192.png?v=1.0.2',
  './icons/maskable-512.png?v=1.0.2'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.endsWith('anilist.co')) return;
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/navigation/tomo-nav.js')) {
    event.respondWith(
      caches.match('./navigation/tomo-nav.js?v=1.2.1')
        .then(cached => cached || fetch(request))
    );
    return;
  }

  // The navigation module still asks for the v1.2.0 randomizer stylesheet.
  // Route that request to the repaired v1.2.2 asset in this cache so iOS
  // cannot keep serving the broken stacking-context version.
  if (url.pathname.endsWith('/randomizer/tomo-randomizer-filters.css')) {
    event.respondWith(
      caches.match('./randomizer/tomo-randomizer-filters.css?v=1.2.2')
        .then(cached => cached || fetch(request))
    );
    return;
  }

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
