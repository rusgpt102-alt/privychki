// Increase VERSION for every deployment that changes application files.
const VERSION = '3';
const PREFIX = 'privychki-app-';
const CACHE = PREFIX + VERSION;
const ROOT = new URL('./', self.location).href;
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'pwa.js', 'weather.js',
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
    if (url.pathname === new URL('data.json', ROOT).pathname) {
      try {
        const response = await fetch(request, {cache: 'no-store', signal: AbortSignal.timeout(10000)});
        if (!response.ok) throw Error('Weather unavailable');
        const data = await response.clone().json();
        const c = data?.current, d = data?.today;
        const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
        const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
        if (data?.version !== 1 || !validTime(data.updated_at) || !c || !d ||
            !finite(c.temperature_c,-100,70) || !finite(c.feels_like_c,-120,90) ||
            !finite(c.wind_ms,0,150) || !finite(c.weather_code,0,99) ||
            !finite(d.temperature_min_c,-100,70) || !finite(d.temperature_max_c,-100,70) ||
            !finite(d.precipitation_probability_percent,0,100) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !validTime(d.sunrise) || !validTime(d.sunset) ||
            Date.parse(data.updated_at) > Date.now() + 300000) throw Error('Invalid weather');
        await cache.put(new URL('data.json', ROOT).href, response.clone());
        return response;
      } catch {
        const saved = await cache.match(new URL('data.json', ROOT).href);
        if (!saved) return new Response('Weather unavailable', {status: 503});
        const headers = new Headers(saved.headers);
        headers.set('X-Weather-Cache', 'fallback');
        return new Response(saved.body, {status: 200, headers});
      }
    }
    if (request.mode === 'navigate') return (await cache.match(ROOT));
    return (await cache.match(request, {ignoreSearch: true})) || fetch(request);
  })());
});
