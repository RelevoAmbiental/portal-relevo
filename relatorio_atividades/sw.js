// ============================================
// SERVICE WORKER - RELATORIO ATIVIDADES (PWA)
// Portal Relevo
// ============================================

const CACHE_NAME = 'relevo-relatorio-atividades-v1';

const STATIC_CACHE = [
  '/relatorio_atividades/',
  '/relatorio_atividades/index.html',
  '/relatorio_atividades/styles.css',
  '/relatorio_atividades/app.js',
  '/relatorio_atividades/manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

const FIREBASE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebase.googleapis.com',
  'firebaseapp.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (FIREBASE_HOSTS.some(h => url.hostname.includes(h))) return;
  if (req.method !== 'GET') return;

  // Network-first para evitar ficar preso em HTML antigo
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
            return caches.match('/relatorio_atividades/index.html');
          }
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
      )
  );
});
