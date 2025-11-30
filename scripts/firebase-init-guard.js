// ============================================
//  SAFE FIREBASE INIT GUARD — versão unificada
//  Portal Relevo + Orçamento + Cronograma
// ============================================

(function () {
  // Garante que o SDK compat já foi carregado
  if (typeof firebase === "undefined") {
    console.warn("⚠️ Firebase não está disponível ainda — guard ativado depois.");
    return;
  }

  // Evita inicializações duplicadas
  if (window.__RELEVO_FIREBASE__) {
    console.log("⚡ Firebase já inicializado pelo Portal.");
    return;
  }

  try {
    // Configuração ÚNICA do projeto portal-relevo
    const firebaseConfig = {
      apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
      authDomain: "portal-relevo.firebaseapp.com",
      projectId: "portal-relevo",
      storageBucket: "portal-relevo.firebasestorage.app",
      messagingSenderId: "182759626683",
      appId: "1:182759626683:web:2dde2eeef910d4c288569e",
      measurementId: "G-W8TTP3D3YQ"
    };

    const app = firebase.initializeApp(firebaseConfig);

    window.__RELEVO_FIREBASE__ = app;
    window.__RELEVO_AUTH__ = app.auth();
    window.__RELEVO_DB__ = app.firestore();

    console.log("🔥 Firebase inicializado com sucesso pelo Guard (portal-relevo).");
  } catch (err) {
    console.error("❌ Erro ao inicializar Firebase no Guard:", err);
  }
})();
