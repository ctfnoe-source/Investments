// ==================== SERVICE WORKER — Finanzas Pro ====================
// Versión de caché — cambia este número cada vez que hagas un deploy
// para que los usuarios reciban la versión más reciente automáticamente.
const CACHE_VERSION = 'finanzas-pro-v2';

// Archivos que se cachean al instalar la app (shell de la aplicación)
const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
];

// URLs externas que se cachean cuando se usan por primera vez
const RUNTIME_CACHE_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',   // Chart.js
  'cdn.jsdelivr.net',        // chartjs-adapter
];

// ── Instalación: cachear el shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      console.log('[SW] Cacheando shell de la app...');
      return cache.addAll(SHELL_FILES);
    }).then(() => {
      // Activar inmediatamente sin esperar a que se cierre la pestaña
      return self.skipWaiting();
    })
  );
});

// ── Activación: limpiar cachés viejas ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log('[SW] Eliminando caché vieja:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // Tomar control de todas las pestañas abiertas inmediatamente
      return self.clients.claim();
    })
  );
});

// ── Fetch: estrategia según el tipo de recurso ────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Firebase / APIs externas de datos → SIEMPRE red (nunca cachear)
  if (
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') && url.pathname.includes('/firestore') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('api.coingecko.com') ||
    url.hostname.includes('finnhub.io') ||
    url.hostname.includes('alphavantage.co') ||
    url.hostname.includes('frankfurter.app')
  ) {
    // Network-only: dejar pasar sin interceptar
    return;
  }

  // 2. Archivos del shell (HTML, JS, CSS) → Cache-first, fallback a red
  if (
    url.hostname === self.location.hostname ||
    RUNTIME_CACHE_PATTERNS.some(p => url.hostname.includes(p))
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        // No está en caché → ir a la red y guardar para próxima vez
        return fetch(event.request).then(response => {
          // Solo cachear respuestas válidas (no errores, no opaque de otros orígenes críticos)
          if (!response || response.status !== 200) return response;

          const toCache = response.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(event.request, toCache);
          });
          return response;
        }).catch(() => {
          // Sin red y sin caché → devolver el index.html para que la app maneje el error
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }
});

// ── Mensajes desde la app principal ──────────────────────────────────────
self.addEventListener('message', event => {
  // La app puede pedir que el SW tome control inmediatamente
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // La app puede pedir que se limpie la caché (útil tras un deploy)
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_VERSION).then(() => {
      event.source.postMessage('CACHE_CLEARED');
    });
  }
});
