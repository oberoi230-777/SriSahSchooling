const SHELL_CACHE = 'srisah-shell-v3';
const SHELL_FILES = ['/','/portal','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png','/icons/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('srisah-') && key !== SHELL_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Cache only fingerprinted UI assets. Never cache student records, account tokens,
  // contact submissions, or any API response in the browser's offline cache.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
    return;
  }

  if (request.mode === 'navigate') {
    const fallbackPath = url.pathname === '/portal' || url.pathname.startsWith('/portal/') ? '/portal' : '/';
    event.respondWith(fetch(request).catch(async () => (await caches.open(SHELL_CACHE)).match(fallbackPath)));
  }
});
