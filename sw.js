// sw.js
const CACHE_NAME = 'klikniplay-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/img/klikniplay_icon.svg',
  '/img/naxi.png',
  '/img/radios.png',
  '/img/playradio.png',
  '/img/tdiradio.png',
  '/img/okradio.png',
  '/img/radionovosti.png',
  '/img/radiokosava.png',
  '/img/radioparadise.png',
  '/icons/favicon.ico',
  '/icons/favicon.svg',
  '/icons/favicon-96x96.png',
  '/icons/apple-touch-icon.png',
  '/icons/web-app-manifest-192x192.png',
  '/icons/web-app-manifest-512x512.png',
  '/icons/site.webmanifest'

];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  // Don't cache radio streams (they're live/constantly changing)
  if (event.request.url.includes('streaming.rs') || 
      event.request.url.includes('radiostreaming') ||
      event.request.url.includes('stream.playradio') ||
      event.request.url.includes('streaming.tdiradio') ||
      event.request.url.includes('cast2.asurahosting') ||
      event.request.url.includes('radioparadise')) {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});