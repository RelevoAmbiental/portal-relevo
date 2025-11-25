// ============================================
//  SAFE FIREBASE INIT GUARD — versão estável
// ============================================

(function () {

  // Aguarda Firebase existir (carregado via CDN no portal)
  if (typeof firebase === "undefined") {
    console.warn("⚠️ Firebase não está disponível ainda — guard ativado.");
    return;
  }

  // Evita inicializações duplicadas
  if (window.__RELEVO_FIREBASE__) {
    console.log("⚡ Firebase já inicializado pelo Portal.");
    return;
  }

  try {
    // Inicialização segura (mesma config usada no portal)
    window.__RELEVO_FIREBASE__ = firebase.initializeApp({
      apiKey: "AIzaSyBqiHNN-Jschlhl50iTYLDsBsLNaXuCu2E",
      authDomain: "portal-relevo.firebaseapp.com",
      projectId: "portal-relevo",
      storageBucket: "portal-relevo.appspot.com",
      messagingSenderId: "704785780097",
      appId: "1:704785780097:web:7acda63c1ab4461f4b0cfe"
    });

    console.log("🔥 Firebase inicializado com sucesso pelo Guard.");

  } catch (err) {
    console.error("❌ Erro ao inicializar Firebase no Guard:", err);
  }
})();
