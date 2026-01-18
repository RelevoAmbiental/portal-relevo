const CACHE = "relevo-apps-launcher-v2";
const ASSETS = [
  "/apps/",
  "/apps/index.html",
  "/apps/styles.css",
  "/apps/app.js",
  "/apps/apps.config.js",
  "/apps/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Só controla escopo /apps/
  if (!url.pathname.startsWith("/apps/")) return;

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
