const CACHE_NAME = "astrokinetics-astra-v5.2.2";
const PRECACHE_URLS = [
  "/",
  "/studio",
  "/project",
  "/llms.txt",
  "/static/app.js?v=5.2.0",
  "/static/dsp.js?v=5.2.0",
  "/static/audio_engine.js?v=4.0.0",
  "/static/biomech3d.js?v=4.0.0",
  "/static/styles.css?v=5.2.1",
  "/static/project.css?v=5.2.1",
  "/static/astra_companion.js?v=5.1.2",
  "/static/grok_voice_widget.css?v=5.0.0",
  "/static/grok_voice_widget.js?v=5.1.4",
  "/static/showcase/brand/ai-med.svg",
  "/static/qr/qr-live-app.svg",
  "/static/qr/qr-project.svg",
  "/static/qr/qr-youtube-demo.svg",
  "/static/qr/qr-github.svg",
  "/manifest.webmanifest",
  "/api/scenarios",
  "/api/osdr-empirical",
  "/api/hunch/catalog",
  "/api/aura/overview",
  "/api/aura/radlab",
  "/api/verification-report",
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
  if (reqUrl.pathname.startsWith("/api/voice/") || reqUrl.pathname.startsWith("/api/ingest/")) return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((resp) => {
        if (resp && resp.status === 200 && !reqUrl.pathname.startsWith("/media/")) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (
          event.request.mode === "navigate" &&
          reqUrl.origin === self.location.origin &&
          ["/", "/studio", "/project"].includes(reqUrl.pathname)
        ) {
          const shell = await cache.match(reqUrl.pathname);
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
