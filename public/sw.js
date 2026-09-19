/**
 * Service worker for the installed employee app.
 *
 * Deliberately small. This is an HR app whose whole point is showing current
 * leave and meeting state, so nothing here tries to serve stale data:
 *
 *  - Cross-origin requests are ignored entirely. Firestore, Cloudinary and the
 *    Google Fonts CDN are left alone — Firestore in particular runs its own
 *    persistence layer and a cache in front of it would fight that.
 *  - Build assets are content-hashed by Vite, so a given URL never changes
 *    content and cache-first is both safe and the fastest option. A new build
 *    produces new URLs and the old ones are dropped on activate.
 *  - Navigations go to the network first and fall back to the cached shell, so
 *    a cold spot on a phone opens the app rather than the browser's error page.
 */

// Bumped to v2 when the auth background went from a 3.3 MB PNG to a 180 kB WebP.
// Content-hashing means the new asset has a new URL, so nothing serves stale —
// but "activate" only deletes caches whose key differs, so without a bump an
// existing install would hold the old 3.3 MB file indefinitely with nothing
// reachable to evict it.
const CACHE = "kora-v2";
const SHELL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error()))
    );
    return;
  }

  if (new URL(request.url).pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
