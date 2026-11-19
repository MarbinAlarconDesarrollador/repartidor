/**
 * Service Worker de "El Repartidor Exprés"
 * Cachea los recursos locales de la PWA y la librería Three.js desde CDN
 * para garantizar el funcionamiento 100% sin conexión a internet.
 */

const CACHE_NAME = 'repartidor-expres-v2';

// Archivos locales de la aplicación
const LOCAL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Recursos externos de Three.js (CDN)
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.core.js',
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js',
];

const PRECACHE_URLS = [...LOCAL_ASSETS, ...CDN_ASSETS];

// Instalación: precachear recursos locales y CDN
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const request = new Request(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin' });
            const response = await fetch(request);
            if (response && (response.ok || response.type === 'opaque')) {
              await cache.put(url, response);
            }
          } catch {
            // Ignora fallos individuales en rutas opcionales (p. ej. durante desarrollo Vite)
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés antiguas y tomar el control inmediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Interceptar peticiones GET: Cache-First para CDN y Network-Fallback para navegación/locales
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isCDN = url.hostname.includes('cdn.jsdelivr.net');
  const isSameOrigin = url.origin === self.location.origin;

  if (!isCDN && !isSameOrigin) return;

  if (isCDN) {
    // Estrategia Cache-First para archivos inmutables de Three.js
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Para recursos locales: Cache-First con actualización en segundo plano (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Si falla la red en una navegación offline, devolver index.html cacheado
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });

      return cached || fetchPromise;
    })
  );
});
