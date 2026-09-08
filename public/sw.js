const CACHE_NAME = 'ctbmf-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use try-catch or individual add to not fail the whole install if one fails
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first for navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      self.fetch(request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Cache-first for assets
  event.respondWith(
    caches.match(request).then((response) => {
      return response || self.fetch(request);
    })
  );
});
