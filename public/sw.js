/* global self, clients */
self.addEventListener('install', () => {
  // Activate the new service worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Claim control so updated SW applies instantly
    await clients.claim();
  })());
});

// You can leave this empty if you just want skipWaiting behaviour.
// next-pwa will append its precache manifest here automatically.
