// despesas/firebase-config.js - CONFIGURAÇÃO COMPLETA CORRIGIDA
const firebaseConfig = {
    apiKey: "AIzaSyCDIrPqQs7S_E2UeDGPNeFCVYcv09JFoTs",
    authDomain: "app-despesas-7029f.firebaseapp.com",
    projectId: "app-despesas-7029f",
    storageBucket: "app-despesas-7029f.appspot.com",
    messagingSenderId: "843931176271",
    appId: "1:843931176271:web:5cdafdd10bc28c3bd8893a"
};

// Inicializar Firebase APENAS se não existir
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // Já inicializado, usar essa instância
}

// Inicializar serviços - USANDO firebase. diretamente
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Configuração do Firestore para dados offline
db.enablePersistence()
  .catch((err) => {
      console.log('Persistência falhou: ', err);
  });

console.log('Firebase Despesas configurado!');
