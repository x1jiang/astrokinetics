const CACHE_NAME = "astrokinetics-v3.4.0-r2-edge-cache";
const PRECACHE_URLS = [
  "/",
  "/static/styles.css?v=3.4.0",
  "/static/dsp.js?v=3.4.0",
  "/static/biomech3d.js?v=3.4.0",
  "/static/audio_engine.js?v=3.4.0",
  "/static/app.js?v=3.4.0",
  "/manifest.webmanifest",
  "/api/scenarios",
  "/api/osdr-empirical",
  "/api/kinematic-sample",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-cache" })
      .then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
