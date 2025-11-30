// =======================================================================
//  FIREBASE INIT GUARD – Portal Relevo (Compat v9)
//  Inicializa Firebase UMA ÚNICA VEZ e expõe instâncias globais seguras.
// =======================================================================

(function () {
  // Evita execução fora do browser
  if (typeof window === "undefined") {
    console.warn("⚠️ Guard ignorado (não está no browser).");
    return;
  }

  // Evita re-inicialização duplicada
  if (window.__RELEVO_FIREBASE__) {
    console.log("⚡ Firebase já inicializado (Guard).");
    return;
  }

  // Exige que o SDK compat já tenha carregado
  if (typeof firebase === "undefined" || !firebase.initializeApp) {
    console.error("❌ Firebase compat NÃO carregado antes do Guard.");
    return;
  }

  try {
    // Config único e fixo do Portal
    const firebaseConfig = {
      apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4e100w",
      authDomain: "portal-relevo.firebaseapp.com",
      projectId: "portal-relevo",
      storageBucket: "portal-relevo.firebasestorage.app",
      messagingSenderId: "182759626683",
      appId: "1:182759626683:web:2dde2eeef910d4c288569e",
      measurementId: "G-W8TTP3D3YQ"
    };

    // Inicializa apenas uma vez
    const app = firebase.initializeApp(firebaseConfig);

    // Firestore e Auth compat
    const auth = app.auth();
    const db = app.firestore();

    // Expõe globalmente (para cronograma e outros módulos do portal)
    window.__RELEVO_FIREBASE__ = app;
    window.__RELEVO_AUTH__ = auth;
    window.__RELEVO_DB__ = db;

    console.log("🔥 Firebase inicializado com sucesso pelo Guard (portal-relevo).");

  } catch (err) {
    console.error("❌ Erro ao inicializar Firebase no Guard:", err);
  }
})();
