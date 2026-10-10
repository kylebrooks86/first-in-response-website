/* Served only by the isolated localhost demo, under its own directory scope. */
const CACHE = '__CACHE_NAME__';
const PREFIX = 'fire-synthetic-customer-shell:';
const ASSETS = __ASSET_LIST__;
function allowed(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && url.origin === self.location.origin && !url.search && ASSETS.includes(url.pathname);
}
async function staticResponse(path) {
  const response = await fetch(new Request(new URL(path, self.location.origin), { credentials: 'omit', cache: 'no-store' }));
  if (!response.ok || response.redirected || new URL(response.url).pathname !== path
    || response.headers.get('X-Fire-Synthetic-Asset') !== '1') throw new Error('Synthetic static asset unavailable.');
  return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Fetch and validate the complete shell before writing any entries.
    const responses = [];
    for (const path of ASSETS) responses.push(await staticResponse(path));
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map((path, i) => cache.put(path, responses[i])));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (!allowed(event.request)) return; // No APIs, queries, POSTs, financial responses or external URLs.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), cached = await cache.match(event.request.url);
    if (cached) return cached;
    try {
      const response = await staticResponse(new URL(event.request.url).pathname);
      await cache.put(event.request.url, response.clone()); return response;
    } catch {
      const navigation = event.request.mode === 'navigate';
      return new Response(navigation ? '<!doctype html><title>Offline demo unavailable</title><p>Offline demo assets are missing. Reconnect to repair this synthetic shell. Encrypted records have not been erased.</p>' : "throw new Error('Offline demo asset missing; reconnect to repair.');", { status: 503, headers: { 'Content-Type': navigation ? 'text/html' : 'text/javascript', 'Cache-Control': 'no-store' } });
    }
  })());
});
