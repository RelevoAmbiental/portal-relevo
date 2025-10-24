// despesas/firebase-config.js - CONFIGURAÇÃO CORRETA COM STORAGE
const firebaseConfig = {
    apiKey: "AIzaSyCDIrPqQs7S_E2UeDGPNeFCVYcv09JFoTs",
    authDomain: "app-despesas-7029f.firebaseapp.com",
    projectId: "app-despesas-7029f",
    storageBucket: "app-despesas-7029f.firebasestorage.app", // Tente este primeiro
    messagingSenderId: "843931176271",
    appId: "1:843931176271:web:5cdafdd10bc28c3bd8893a"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('🔥 Firebase inicializado com Storage');
}

// Inicializar serviços
const db = firebase.firestore();
const storage = firebase.storage();

// Configurar persistência
db.enablePersistence()
  .catch((err) => {
      console.log('Persistência falhou: ', err);
  });

console.log('✅ Firebase configurado!');
console.log('📦 Storage Bucket:', firebase.app().options.storageBucket);
