// ==================== SERVICE WORKER — Finanzas Pro ====================
// Versión de caché — cambia este número cada vez que hagas un deploy
// para que los usuarios reciban la versión más reciente automáticamente.
const CACHE_VERSION = 'finanzas-pro-v22';

// Archivos JS/CSS que usan Network-first (siempre intenta red antes)
const NETWORK_FIRST_FILES = ['./app.js', './styles.css', './index.html', '/'];

// Archivos que se cachean al instalar (solo shell estático)
const SHELL_FILES = [
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
      return self.clients.claim();
    })
  );
});

// ── Fetch: estrategia según el tipo de recurso ────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const pathname = url.pathname;

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
    return; // Network-only
  }

  // 2. app.js y styles.css → Network-first (actualización inmediata)
  //    Si hay red, siempre sirve la versión más nueva.
  //    Solo usa caché si no hay conexión (modo offline).
  if (
    url.hostname === self.location.hostname &&
    (NETWORK_FIRST_FILES.some(f => pathname.endsWith(f.replace('./', '/'))) || pathname === '/' || pathname.endsWith('/index.html'))
  ) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const toCache = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => {
        // Sin red → caché como fallback
        return caches.match(event.request);
      })
    );
    return;
  }

  // 3. Resto del shell e imágenes locales → Cache-first, fallback a red
  if (
    url.hostname === self.location.hostname ||
    RUNTIME_CACHE_PATTERNS.some(p => url.hostname.includes(p))
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;

          const toCache = response.clone();
          caches.open(CACHE_VERSION).then(cache => {
            cache.put(event.request, toCache);
          });
          return response;
        }).catch(() => {
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
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_VERSION).then(() => {
      event.source.postMessage('CACHE_CLEARED');
    });
  }
});
