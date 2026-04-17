const CACHE_NAME = "veil-checklist-v1";
const CHECKLIST_PATTERN = /\/checklist\//;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only cache checklist page navigations and their assets
  if (!CHECKLIST_PATTERN.test(url.pathname) && !url.pathname.startsWith("/api/checklist")) {
    return;
  }

  // For API calls (PATCH/POST), don't cache — let them fail gracefully in the app
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);

      return cached ?? fetchPromise;
    })
  );
});
