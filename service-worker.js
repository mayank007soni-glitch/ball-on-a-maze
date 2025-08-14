/* Simple, safe cache-first service worker for GitHub Pages */
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `ball-maze-${CACHE_VERSION}`;

/* Add core files you want available offline */
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
  // If you split your CSS/JS into separate files, list them here too.
];

/* Install: pre-cache core assets */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/* Activate: clean old caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

/* Fetch: cache-first for same-origin GET requests */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin, GET requests
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Cache a clone of successful, basic (same-origin) responses
          if (response && response.status === 200 && response.type === 'basic') {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
          }
          return response;
        })
        .catch(() => {
          // Optional: fallback to index.html for navigations while offline
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});