// ============================================
// SERVICE WORKER - DESPESAS RELEVO PWA
// Versão: 1.0.0
// Relevo Consultoria Ambiental
// ============================================

const CACHE_NAME = 'despesas-relevo-v1.0.0';
const CACHE_VERSION = '1.0.0';

// ============================================
// ARQUIVOS PARA CACHE OFFLINE
// ============================================
const STATIC_CACHE = [
  '/despesas/',
  '/despesas/index.html',
  '/despesas/app.js',
  '/despesas/firebase-config.js',
  '/despesas/manifest.json',
  '/despesas/icon-192x192.png',
  '/despesas/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// URLs do Firebase (NÃO cachear - sempre buscar online)
const FIREBASE_URLS = [
  'firebasestorage.googleapis.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebase.googleapis.com',
  'firebaseapp.com'
];

// ============================================
// INSTALAÇÃO DO SERVICE WORKER
// ============================================
self.addEventListener('install', (event) => {
  console.log('📦 [SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ [SW] Cache criado:', CACHE_NAME);
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        console.log('✅ [SW] Arquivos em cache');
        return self.skipWaiting(); // Ativar imediatamente
      })
      .catch((error) => {
        console.error('❌ [SW] Erro na instalação:', error);
      })
  );
});

// ============================================
// ATIVAÇÃO DO SERVICE WORKER
// ============================================
self.addEventListener('activate', (event) => {
  console.log('🔄 [SW] Ativando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Remover caches antigos
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ [SW] Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ [SW] Service Worker ativado - Versão:', CACHE_VERSION);
        return self.clients.claim(); // Controlar todas as páginas
      })
  );
});

// ============================================
// INTERCEPTAR REQUISIÇÕES (ESTRATÉGIA DE CACHE)
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições do Firebase (sempre buscar online)
  if (FIREBASE_URLS.some(fbUrl => url.hostname.includes(fbUrl))) {
    return; // Deixa passar direto para o Firebase
  }

  // Ignorar requisições POST/PUT/DELETE (só cachear GET)
  if (request.method !== 'GET') {
    return;
  }

  // ESTRATÉGIA: Network First, depois Cache
  // Tenta buscar da rede, se falhar busca do cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Se conseguiu da rede com sucesso
        if (response && response.status === 200) {
          // Clona resposta para salvar no cache
          const responseClone = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhou (offline), busca do cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('📦 [SW] Servindo do cache:', request.url);
            return cachedResponse;
          }
          
          // Se não tem no cache e é HTML, retorna página principal
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/despesas/index.html');
          }
          
          // Se não achou nada, retorna resposta vazia
          return new Response('Offline - Conteúdo não disponível', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// ============================================
// MENSAGENS DO APP PARA SERVICE WORKER
// ============================================
self.addEventListener('message', (event) => {
  console.log('💬 [SW] Mensagem recebida:', event.data);
  
  // Pular espera e ativar nova versão
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('⏭️ [SW] Pulando espera e ativando nova versão');
    self.skipWaiting();
  }
  
  // Retornar versão atual
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ 
      version: CACHE_VERSION,
      cacheName: CACHE_NAME 
    });
  }
  
  // Limpar cache manualmente
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('🗑️ [SW] Cache limpo');
      event.ports[0].postMessage({ cleared: true });
    });
  }
});

// ============================================
// SINCRONIZAÇÃO EM BACKGROUND (FUTURO)
// ============================================
self.addEventListener('sync', (event) => {
  console.log('🔄 [SW] Sincronização em background:', event.tag);
  
  if (event.tag === 'sync-despesas') {
    event.waitUntil(
      // Aqui você pode sincronizar despesas offline quando voltar online
      sincronizarDespesas()
    );
  }
});

async function sincronizarDespesas() {
  console.log('📤 [SW] Sincronizando despesas offline...');
  // TODO: Implementar sincronização de despesas salvas offline
  return Promise.resolve();
}

// ============================================
// NOTIFICAÇÕES PUSH (FUTURO)
// ============================================
self.addEventListener('push', (event) => {
  console.log('🔔 [SW] Notificação push recebida');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Despesas Relevo', body: event.data.text() };
    }
  }
  
  const title = data.title || 'Despesas Relevo';
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/despesas/icon-192x192.png',
    badge: '/despesas/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: '/despesas/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================
// CLIQUE EM NOTIFICAÇÕES
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('👆 [SW] Notificação clicada:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Abrir ou focar na página do app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se já tem uma janela aberta, foca nela
        for (let client of clientList) {
          if (client.url.includes('/despesas/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Se não tem, abre nova janela
        if (clients.openWindow) {
          return clients.openWindow('/despesas/');
        }
      })
  );
});

// ============================================
// ATUALIZAÇÃO PERIÓDICA DE CACHE (OPCIONAL)
// ============================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(atualizarCache());
  }
});

async function atualizarCache() {
  console.log('🔄 [SW] Atualizando cache periodicamente...');
  const cache = await caches.open(CACHE_NAME);
  return cache.addAll(STATIC_CACHE);
}

// ============================================
// LOG DE INICIALIZAÇÃO
// ============================================
console.log('✅ [SW] Service Worker carregado');
console.log('📦 [SW] Versão:', CACHE_VERSION);
console.log('💾 [SW] Cache:', CACHE_NAME);
console.log('📄 [SW] Arquivos em cache:', STATIC_CACHE.length);
