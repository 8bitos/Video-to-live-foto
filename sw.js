/**
 * sw.js — LiveBit Service Worker v5.0
 * Provides offline support and enables PWA installation on Android & Desktop.
 */

const CACHE_NAME = 'livebit-v5.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './app.js?v=5.0',
  './motionEngine.js?v=5.0',
  './i18n.js?v=5.0',
  './funfacts.js',
  './manifest.webmanifest',
  './lib/mp4-muxer.js',
  './lib/jszip.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      // Return cached version or fetch from network and cache
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkRes;
      }).catch(() => {
        // Offline fallback
        return cached;
      });

      return cached || fetchPromise;
    })
  );
});
