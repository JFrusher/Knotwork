/*
 * Keeps the Binder, and a helper's page, for when there is no signal —
 * venues are often in a valley. Registered for /binder and for /helper/ (see
 * lib/offline.ts); the planning app is not cached.
 *
 * The page hands over every file it loaded, and those are kept. A page load
 * tries the network first and falls back to the kept page; files are served
 * from what was kept, and kept anew when fetched. What the pages show never
 * passes through here: the wedding, or a helper's opened sheet, is already on
 * the phone, and the API is never cached.
 */
const KEPT = "binder-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const urls = Array.isArray(event.data?.keep) ? event.data.keep : [];
  event.waitUntil(caches.open(KEPT).then((cache) => Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)))));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only a page that worked replaces the kept one: an error kept here
          // would be all the Binder could show once the signal went.
          if (response.ok) {
            const copy = response.clone();
            void caches.open(KEPT).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(() => caches.match(url.pathname).then((kept) => kept ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (kept) =>
        kept ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(KEPT).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
