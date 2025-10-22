// js/firebase-config.js - CONFIGURAÇÃO COMPLETA DO PORTAL PRINCIPAL
const firebaseConfig = {
  apiKey: "AIzaSyCDIrPqQs7S_E2UeDGPNeFCVYcv09JFoTs",
  authDomain: "app-despesas-7029f.firebaseapp.com",
  projectId: "app-despesas-7029f",
  storageBucket: "app-despesas-7029f.appspot.com", // ADICIONADO STORAGE
  messagingSenderId: "843931176271",
  appId: "1:843931176271:web:5cdafdd10bc28c3bd8893a"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);

// Inicializar serviços Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage(); // ADICIONADO STORAGE

// Configurar persistência offline do Firestore
db.enablePersistence()
  .catch((err) => {
    console.log('Persistência do Firestore falhou: ', err);
  });

console.log('Firebase configurado com sucesso!');
