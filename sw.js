// Updated sw.js
const CACHE_NAME = 'klikniplay-v4';
const BASE_PATH = '/radio-sajt/';
const ASSETS_TO_CACHE = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'styles.css',
  BASE_PATH + 'script.js',
  BASE_PATH + 'img/naxi.png',
  BASE_PATH + 'img/radios.png',
  BASE_PATH + 'img/playradio.png',
  BASE_PATH + 'img/tdiradio.png',
  BASE_PATH + 'img/okradio.png',
  BASE_PATH + 'img/radionovosti.png',
  BASE_PATH + 'img/radiokosava.png',
  BASE_PATH + 'img/radioparadise.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE.map(url => new Request(url, {cache: 'reload'})))
                   .catch(err => console.log('Failed to cache:', err));
      })
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