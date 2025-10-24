// despesas/firebase-config.js - CONFIGURAÇÃO UNIFICADA
const firebaseConfig = {
    apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
    authDomain: "portal-relevo.firebaseapp.com",
    projectId: "portal-relevo",
    storageBucket: "portal-relevo.firebasestorage.app",
    messagingSenderId: "182759626683",
    appId: "1:182759626683:web:2dde2eeef910d4c288569e"
};

// Inicializar Firebase apenas uma vez
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('🔥 Firebase inicializado - PROJETO UNIFICADO: portal-relevo');
}

// Inicializar serviços
const db = firebase.firestore();
const storage = firebase.storage();

// Configurar persistência
db.enablePersistence()
  .catch((err) => {
      console.log('Persistência falhou: ', err);
  });

console.log('✅ Firebase configurado com projeto unificado!');
