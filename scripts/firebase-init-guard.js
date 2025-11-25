// scripts/firebase-init-guard.js - versão compat para PORTAL Relevo

// Verifica se o Firebase já está inicializado
if (!window.firebase || !firebase.apps.length) {
  const firebaseConfig = {
    apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
    authDomain: "portal-relevo.firebaseapp.com",
    projectId: "portal-relevo",
    storageBucket: "portal-relevo.firebasestorage.app",
    messagingSenderId: "182759626683",
    appId: "1:182759626683:web:2dde2eeef910d4c288569e",
    measurementId: "G-W8TTP3D3YQ"
  };

  firebase.initializeApp(firebaseConfig);
  console.log("✅ Firebase compat inicializado pelo guard (portal-relevo)");
}

// Cria aliases globais para o app e serviços
window.__RELEVO_APP__ = firebase.app();
window.__RELEVO_AUTH__ = firebase.auth();
if (!auth) {
  console.error("❌ Firebase do Portal não carregou.");
}
window.__RELEVO_DB__ = firebase.firestore();
