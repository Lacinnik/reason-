const VERSION = '2.0.0-rc.1';
const SHELL_CACHE = `rte-shell-${VERSION}`;
const RUNTIME_CACHE = `rte-runtime-${VERSION}`;
const PINNED_TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './engine-core.js',
  './storage.js',
  './manifest.webmanifest',
  './icon.svg',
  './vendor/transformers-3.7.2.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(async (cache) => {
        await cache.addAll(SHELL);
        try {
          await cache.add(PINNED_TRANSFORMERS);
        } catch (error) {
          console.warn('Pinned Transformers.js runtime will be cached on first use.', error);
        }
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('rte-shell-') || key.startsWith('rte-runtime-'))
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function putRuntime(request, response) {
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    return await putRuntime(request, await fetch(request));
  } catch {
    return (await cache.match(request)) || (await caches.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return putRuntime(request, await fetch(request));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.url === PINNED_TRANSFORMERS || (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@huggingface/transformers@3.7.2'))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const update = fetch(request)
        .then((response) => putRuntime(request, response))
        .catch(() => null);
      event.waitUntil(update);
      return cached || update.then((response) => response || Response.error());
    }),
  );
});
