// Minimal service worker: makes the app installable and takes control
// immediately. Network-first passthrough; no offline caching layer yet.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Passthrough: let the network handle everything
});
