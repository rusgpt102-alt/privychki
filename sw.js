// Increase VERSION for every deployment that changes application files.
const VERSION = '2';
const PREFIX = 'privychki-app-';
const CACHE = PREFIX + VERSION;
const ROOT = new URL('./', self.location).href;
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'pwa.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(FILES.map(file => new Request(new URL(file, ROOT), {cache: 'reload'})))));
  // Let existing tabs finish using their version before activating an update.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.href.startsWith(ROOT)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') return (await cache.match(ROOT));
    return (await cache.match(request, {ignoreSearch: true})) || fetch(request);
  })());
});
