// ============================================
// FIREBASE CONFIGURATION - APP DE DESPESAS
// Relevo Consultoria Ambiental - 2025
// Projeto: app-despesas-7029f
// ============================================

// Configuração do Firebase para o projeto de despesas
const firebaseConfig = {
    apiKey: "AIzaSyCDIrPqQs7S_E2UeDGPNeFCVYcv09JFoTs",
    authDomain: "app-despesas-7029f.firebaseapp.com",
    projectId: "app-despesas-7029f",
    storageBucket: "app-despesas-7029f.firebasestorage.app",
    messagingSenderId: "843931176271",
    appId: "1:843931176271:web:5cdafdd10bc28c3bd8893a"
};

// ============================================
// INICIALIZAR FIREBASE
// ============================================
try {
    // Inicializar apenas se ainda não foi inicializado
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase inicializado com sucesso');
        console.log('📦 Projeto:', firebaseConfig.projectId);
    } else {
        console.log('ℹ️ Firebase já estava inicializado');
        firebase.app(); // Usa a instância existente
    }
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    alert('Erro ao conectar com o servidor. Recarregue a página.');
}

// ============================================
// INICIALIZAR SERVIÇOS
// ============================================
let db, storage;

try {
    // Firestore Database
    db = firebase.firestore();
    console.log('✅ Firestore inicializado');

    // Storage para uploads
    storage = firebase.storage();
    console.log('✅ Storage inicializado');

    // ============================================
    // CONFIGURAR PERSISTÊNCIA (OFFLINE)
    // ============================================
    db.enablePersistence({
        synchronizeTabs: true
    })
    .then(() => {
        console.log('✅ Persistência offline habilitada');
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('⚠️ Persistência não habilitada: múltiplas abas abertas');
        } else if (err.code === 'unimplemented') {
            console.warn('⚠️ Persistência não suportada neste navegador');
        } else {
            console.error('❌ Erro ao habilitar persistência:', err);
        }
    });

} catch (error) {
    console.error('❌ Erro ao inicializar serviços Firebase:', error);
}

// ============================================
// CONFIGURAÇÕES DE STORAGE
// ============================================
// Configurar limites e comportamento do Storage
const storageConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    acceptedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
    uploadPath: 'comprovantes/'
};

// ============================================
// VERIFICAR CONEXÃO
// ============================================
window.addEventListener('online', () => {
    console.log('🌐 Conexão restaurada');
    if (db) {
        db.enableNetwork()
            .then(() => console.log('✅ Firestore online'))
            .catch(err => console.error('❌ Erro ao reconectar Firestore:', err));
    }
});

window.addEventListener('offline', () => {
    console.warn('📴 Sem conexão - Modo offline ativado');
    if (db) {
        db.disableNetwork()
            .then(() => console.log('ℹ️ Firestore em modo offline'))
            .catch(err => console.error('❌ Erro ao desconectar Firestore:', err));
    }
});

// ============================================
// EXPORTAR CONFIGURAÇÕES (PARA USO NO APP.JS)
// ============================================
console.log('🎯 Firebase configurado e pronto para uso!');
console.log('📊 Configurações:', {
    projeto: firebaseConfig.projectId,
    storage: storageConfig.uploadPath,
    maxFileSize: `${storageConfig.maxFileSize / 1024 / 1024}MB`,
    tiposAceitos: storageConfig.acceptedTypes.length
});
