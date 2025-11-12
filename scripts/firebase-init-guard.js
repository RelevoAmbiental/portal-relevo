// scripts/firebase-init-guard.js - versão compat, sem export

// Verifica se o Firebase já está inicializado
if (!window.firebase || !firebase.apps.length) {
  const firebaseConfig = {
    apiKey: "AIzaSyCM4w5r60HHXLDS8tayldew0OfWXU3ZIJk",
    authDomain: "revelo-orcamentos.firebaseapp.com",
    projectId: "revelo-orcamentos",
    storageBucket: "revelo-orcamentos.firebasestorage.app",
    messagingSenderId: "256492526393",
    appId: "1:256492526393:web:81ff8efdd3c3accb9226e8"
  };

  firebase.initializeApp(firebaseConfig);
  console.log("✅ Firebase compat inicializado pelo guard");
}

// Cria aliases globais para o app e serviços
window.__RELEVO_APP__ = firebase.app();
window.__RELEVO_AUTH__ = firebase.auth();
window.__RELEVO_DB__ = firebase.firestore();
