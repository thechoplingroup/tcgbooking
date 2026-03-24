// Service Worker — offline detection
const CACHE_NAME = "kcs-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Just let requests through; we rely on the app's offline banner
  event.respondWith(
    fetch(event.request).catch(() => {
      // For navigation requests return a minimal offline page
      if (event.request.mode === "navigate") {
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — Keri Choplin Studio</title>
<style>
  body { margin: 0; background: #faf8f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: Georgia, serif; }
  .card { text-align: center; padding: 2rem; }
  h1 { color: #1a1714; font-size: 1.5rem; margin: 0 0 0.5rem; }
  p { color: #8a7e78; font-size: 0.875rem; }
  .k { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg,#f5ede8,#e8d8d0); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; border: 2px solid #e8e2dc; }
  .k span { color: #9b6f6f; font-size: 1.75rem; font-weight: 600; }
</style>
</head>
<body>
<div class="card">
  <div class="k"><span>K</span></div>
  <h1>You're offline</h1>
  <p>Check your connection and try again.</p>
</div>
</body>
</html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }
    })
  );
});
