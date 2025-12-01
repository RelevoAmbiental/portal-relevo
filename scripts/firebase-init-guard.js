// =======================================================================
//  FIREBASE INIT GUARD – Portal Relevo (Compat v9)
//  Inicializa Firebase UMA ÚNICA VEZ e expõe instâncias globais seguras.
// =======================================================================

(function () {
  if (typeof window === "undefined") {
    console.warn("⚠️ Guard ignorado (não está no browser).");
    return;
  }

  if (window.__RELEVO_FIREBASE__) {
    console.log("⚡ Firebase já inicializado (Guard).");
    return;
  }

  if (typeof firebase === "undefined" || !firebase.initializeApp) {
    console.error("❌ Firebase compat NÃO carregado antes do Guard.");
    return;
  }

  try {
    const firebaseConfig = {
      apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
      authDomain: "portal-relevo.firebaseapp.com",
      projectId: "portal-relevo",
      storageBucket: "portal-relevo.appspot.com",   // ← CORRIGIDO
      messagingSenderId: "182759626683",
      appId: "1:182759626683:web:2dde2eeef910d4c288569e",
      measurementId: "G-W8TTP3D3YQ"
    };

    const app = firebase.initializeApp(firebaseConfig);

    const auth = app.auth();
    const db = app.firestore();

    window.__RELEVO_FIREBASE__ = app;
    window.__RELEVO_AUTH__ = auth;
    window.__RELEVO_DB__ = db;
    // Compatibilidade total com o cronograma-relevo
    window.RelevoFirebase = {
      app,
      auth,
      db,
      storage: app.storage ? app.storage() : null
    };


    console.log("🔥 Firebase inicializado com sucesso pelo Guard (portal-relevo).");

  } catch (err) {
    console.error("❌ Erro ao inicializar Firebase no Guard:", err);
  }
})();
