// ===============================
//  SAFE FIREBASE INIT GUARD
// ===============================

(function () {
  // Só prossegue se firebase existir
  if (typeof firebase === "undefined" || !firebase.apps) {
    console.warn("⚠️ Firebase ainda não carregado — guard ativo.");
    return;
  }

  // Evita reinicialização dupla
  if (window.__RELEVO_FIREBASE__) {
    console.log("⚡ Firebase já inicializado pelo Portal.");
    return;
  }

  // Inicialização segura
  window.__RELEVO_FIREBASE__ = firebase.initializeApp({
    apiKey: "AIzaSyBqiHNN-Jschlhl50iTYLDsBsLNaXuCu2E",
    authDomain: "portal-relevo.firebaseapp.com",
    projectId: "portal-relevo",
    storageBucket: "portal-relevo.appspot.com",
    messagingSenderId: "704785780097",
    appId: "1:704785780097:web:7acda63c1ab4461f4b0cfe"
  });

  console.log("🔥 Firebase inicializado pelo Guard.");
})();
