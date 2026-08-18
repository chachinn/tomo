const CACHE_NAME = 'tomo-shell-v1.3.0-mega-v1-modular';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=1.0.2',
  './navigation/tomo-nav.css?v=1.1.3',
  './app.js?v=1.1.3',
  './navigation/tomo-nav.js?v=1.2.1',
  './randomizer/tomo-randomizer-filters.css?v=1.2.4',
  './randomizer/tomo-randomizer-filters.js?v=1.2.6',
  './randomizer/tomo-randomizer-action-fix.js?v=1.0.0',
  './randomizer/tomo-quick-roll-filter-bridge.js?v=1.0.0',
  './library/tomo-library.css?v=1.1.1',
  './library/tomo-library.js?v=1.1.1',
  './library/tomo-library-sync.css?v=1.1.2',
  './library/tomo-library-sync.js?v=1.1.2',
  './auth/anilist-config.js?v=1.0.2',
  './auth/anilist-auth.js?v=1.1.3',
  './auth/anilist-auth.css?v=1.0.2',
  './css/tomo-v1.css?v=1.0.0',
  './js/tomo-v1.js?v=1.0.0',
  './js/core/storage.js?v=1.0.0',
  './js/core/anilist-client.js?v=1.0.0',
  './js/features/home-v1.js?v=1.0.0',
  './js/features/randomizer-modes.js?v=1.0.0',
  './js/features/discovery-hub.js?v=1.0.0',
  './js/features/library-insights.js?v=1.0.0',
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
    event.respondWith((async () => {
      const base = await caches.match('./navigation/tomo-nav.js?v=1.2.1') || await fetch(request);
      const text = await base.text();
      const loader = `\n;(() => {
        if (!document.querySelector('script[data-tomo-randomizer-action-fix]')) {
          const s=document.createElement('script'); s.src='randomizer/tomo-randomizer-action-fix.js?v=1.0.0'; s.defer=true; s.dataset.tomoRandomizerActionFix='true'; document.body.appendChild(s);
        }
        if (!document.querySelector('script[data-tomo-quick-roll-filter-bridge]')) {
          const q=document.createElement('script'); q.src='randomizer/tomo-quick-roll-filter-bridge.js?v=1.0.0'; q.defer=true; q.dataset.tomoQuickRollFilterBridge='true'; document.body.appendChild(q);
        }
        if (!document.querySelector('link[data-tomo-v1-style]')) {
          const l=document.createElement('link'); l.rel='stylesheet'; l.href='css/tomo-v1.css?v=1.0.0'; l.dataset.tomoV1Style='true'; document.head.appendChild(l);
        }
        if (!document.querySelector('script[data-tomo-v1-module]')) {
          const m=document.createElement('script'); m.type='module'; m.src='js/tomo-v1.js?v=1.0.0'; m.dataset.tomoV1Module='true'; document.body.appendChild(m);
        }
      })();`;
      return new Response(text + loader, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } });
    })());
    return;
  }

  if (url.pathname.endsWith('/randomizer/tomo-randomizer-filters.css')) {
    event.respondWith(caches.match('./randomizer/tomo-randomizer-filters.css?v=1.2.4').then(cached => cached || fetch(request)));
    return;
  }

  if (url.pathname.endsWith('/randomizer/tomo-randomizer-filters.js')) {
    event.respondWith(caches.match('./randomizer/tomo-randomizer-filters.js?v=1.2.6').then(cached => cached || fetch(request)));
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
