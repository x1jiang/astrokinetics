const CACHE_NAME = "astrokinetics-astra-v5.0.0-showcase";
const PRECACHE_URLS = [
  "/studio",
  "/static/styles.css?v=5.0.0",
  "/static/grok_voice_widget.css?v=5.0.0",
  "/static/grok_voice_widget.js?v=5.0.0",
  "/manifest.webmanifest",
  "/api/scenarios",
  "/api/voice/status",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
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
  const reqUrl = new URL(event.request.url);
  if (reqUrl.pathname.startsWith("/api/voice/")) return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((resp) => {
        if (resp && resp.status === 200 && !reqUrl.pathname.startsWith("/media/")) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
