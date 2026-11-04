/* The build script fingerprints CACHE_NAME when making the distributable. */
const CACHE_NAME = 'povtor-v1-dev';
const ASSETS = [
  './', './index.html', './theme.css', './styles.css', './app.js', './domain.js',
  './views.js', './icons.js', './platform.js', './manifest.webmanifest',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png',
];
const scope = new URL('./', self.location.href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('povtor-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('index.html', scope))));
    return;
  }
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    return cached || fetch(event.request);
  }));
});
