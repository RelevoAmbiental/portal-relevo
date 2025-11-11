// ============================================
// FIREBASE INIT GUARD - Relevo Consultoria Ambiental
// ============================================
// Uso: incluir este script após os imports do Firebase SDK (compat)
// e antes de qualquer chamada de auth, firestore ou storage.
//
// Objetivo:
// - Evitar múltiplas inicializações (initializeApp duplicado)
// - Garantir persistência local (auth.setPersistence(...))
// - Compartilhar o mesmo login entre todos os módulos do portal
//
// ================================================================

/* global firebase */

(function () {
  // Configuração unificada do Portal Relevo
  const firebaseConfig = {
    apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
    authDomain: "portal-relevo.firebaseapp.com",
    projectId: "portal-relevo",
    storageBucket: "portal-relevo.firebasestorage.app",
    messagingSenderId: "182759626683",
    appId: "1:182759626683:web:2dde2eeef910d4c288569e"
  };

  try {
    // Evita re-inicialização
    if (firebase.apps && firebase.apps.length) {
      window.__RELEVO_APP__ = firebase.app();
      console.log("ℹ️ Firebase já estava inicializado");
    } else {
      window.__RELEVO_APP__ = firebase.initializeApp(firebaseConfig);
      console.log("✅ Firebase inicializado (Portal Relevo)");
    }

    // Auth compartilhado entre os módulos
    if (firebase.auth) {
      const auth = firebase.auth();

      // Persistência local — mantém login ao trocar de app
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => console.log("✅ Persistência local ativa"))
        .catch(err => console.warn("⚠️ Falha ao definir persistência:", err));

      window.__RELEVO_AUTH__ = auth;
    }
  } catch (error) {
    console.error("❌ Erro ao iniciar Firebase (Guard):", error);
  }
})();

// ============================================================
// 🔄 Monitoramento Global da Autenticação
// ============================================================

// Só executa se o Firebase Auth estiver disponível
if (typeof window !== "undefined" && firebase?.auth) {
  const auth = firebase.auth();

  auth.onAuthStateChanged((u) => {
    // Expõe o usuário autenticado globalmente (para os outros apps usarem)
    window.relevoUser = u || null;

    if (u) {
      console.log("✅ Usuário autenticado detectado:", u.email || u.uid);
      console.log("✅ Persistência local ativa");
    } else {
      console.log("🔒 Nenhum usuário autenticado");
    }
  });
}
