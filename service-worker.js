/* Simple, safe cache-first service worker for GitHub Pages */
// service-worker.js
const CACHE_VERSION = 'v1.0.2'; // ← bump this on each release
const CACHE_NAME    = `ball-maze-${CACHE_VERSION}`;

/* >>> NEW: runtime cache for music files (don’t pre-cache big mp3s) */
const MUSIC_CACHE   = `ball-maze-music-${CACHE_VERSION}`;
// If your GitHub Pages site is at https://<user>.github.io/ball-on-a-maze/
// leave this as-is. If you host at root or a different repo name, adjust.
const MUSIC_PATH_PREFIX = '/ball-on-a-maze/assets/music/';

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

/* Activate: clean old caches (keep both core and music of current version) */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== MUSIC_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* >>> NEW: helper to cap music cache size */
async function limitMusicCache(maxEntries = 8) {
  const cache = await caches.open(MUSIC_CACHE);
  const keys = await cache.keys();
  while (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    keys.shift();
  }
}

/* >>> NEW: quick test for music URLs (same-origin only) */
function isMusicUrl(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(MUSIC_PATH_PREFIX);
}

/* Fetch: cache-first for same-origin GET requests
         + special runtime cache for music */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  /* >>> NEW: music cache-first strategy (runtime) */
  if (isMusicUrl(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(MUSIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      // Not in cache: fetch and store (only successful basic responses)
      const response = await fetch(request);
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone());
        limitMusicCache(8).catch(() => {});
      }
      return response;
    })());
    return;
  }

  /* Default: your original cache-first for core/other same-origin files */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
          }
          return response;
        })
        .catch(() => {
          // Fallback to index.html for navigations while offline
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});