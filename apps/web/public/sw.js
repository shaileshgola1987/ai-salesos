// Minimal service worker: makes the app installable as a PWA (PRD §5) and keeps the app
// shell available offline after a first visit. Deliberately simple — this is not a full
// offline-first cache of every route; the API and app data still require connectivity
// except where a page explicitly queues work locally (see lib/offline-visit-queue.ts for
// field visit check-ins).
const CACHE_NAME = "ai-salesos-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache API responses — this app's data must always be live when online.
  if (url.pathname.startsWith("/api/")) return;

  // Content-hashed static assets: cache-first, they never change under the same URL.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Everything else (pages): network-first, falling back to the last cached copy so the
  // app shell still renders offline instead of showing the browser's offline page.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? Response.error())),
  );
});
