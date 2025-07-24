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
  '/icons/apple-touch-icon.png',
  '/icons/web-app-manifest-192x192.png',
  '/icons/web-app-manifest-512x512.png',
  '/icons/site.webmanifest',
  '/icons/favicon.ico',
  '/icons/favicon-light.ico',
  '/icons/favicon.svg',
  '/icons/favicon-light.svg',
  '/icons/favicon-96x96.png',
  '/icons/favicon-light-96x96.png',

];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Don't cache radio streams (they're live/constantly changing)
  if (event.request.url.includes('streaming.rs') || 
      event.request.url.includes('radiostreaming') ||
      event.request.url.includes('stream.playradio') ||
      event.request.url.includes('streaming.tdiradio') ||
      event.request.url.includes('cast2.asurahosting') ||
      event.request.url.includes('radioparadise') ||
	  event.request.url.endsWith('.svg') || 
      event.request.url.endsWith('.ico') ||
      event.request.url.includes('favicon')) {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});