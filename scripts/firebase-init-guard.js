// ============================================
// 🔥 FIREBASE INIT GUARD - Relevo Consultoria Ambiental
// ============================================
//
// Objetivo:
// - Evitar múltiplas inicializações (initializeApp duplicado)
// - Garantir persistência local (auth.setPersistence(...))
// - Compartilhar o mesmo login entre todos os módulos do portal (orcamento, despesas, cronograma)
// - Disponibilizar acesso global seguro via window.__RELEVO_APP__ e window.relevoUser
//
// Uso: incluir este script após os imports do Firebase SDK (compat)
// e antes de qualquer chamada de auth, firestore ou storage.
//
// ================================================================

/* global firebase */

(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
    authDomain: "portal-relevo.firebaseapp.com",
    projectId: "portal-relevo",
    storageBucket: "portal-relevo.firebasestorage.app",
    messagingSenderId: "182759626683",
    appId: "1:182759626683:web:2dde2eeef910d4c288569e"
  };

  try {
    // ===============================
    // 🚀 Inicialização única
    // ===============================
    if (firebase.apps && firebase.apps.length > 0) {
      window.__RELEVO_APP__ = firebase.app();
      console.log("ℹ️ Firebase já estava inicializado");
    } else {
      window.__RELEVO_APP__ = firebase.initializeApp(firebaseConfig);
      console.log("✅ Firebase inicializado (Portal Relevo)");
    }

    // ===============================
    // 🔐 Autenticação unificada
    // ===============================
    if (firebase.auth) {
      const auth = firebase.auth();
      window.__RELEVO_AUTH__ = auth;

      // Persistência local (mantém login entre abas e apps)
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => console.log("✅ Persistência local ativa"))
        .catch(err => console.warn("⚠️ Falha ao definir persistência:", err));
    } else {
      console.warn("⚠️ Firebase Auth não disponível ainda");
    }

  } catch (error) {
    console.error("❌ Erro ao iniciar Firebase (Guard):", error);
  }
})();

// ============================================================
// 🔄 Monitoramento Global de Autenticação
// ============================================================
//
// Esse trecho mantém o usuário autenticado disponível globalmente,
// para ser reutilizado por subaplicações (orcamento, cronograma etc.)
// sem precisar refazer o login.
//
// ============================================================

if (typeof window !== "undefined" && firebase?.auth) {
  const auth = firebase.auth();

  // Define usuário global assim que detectado
  auth.onAuthStateChanged((u) => {
    window.relevoUser = u || null;

    if (u) {
      console.log("✅ Usuário autenticado detectado:", u.email || u.uid);
      // Evita duplicidade de logs em apps filhos
      if (!window.__RELEVO_USER_LOGGED__) {
        window.__RELEVO_USER_LOGGED__ = true;
        console.log("🔁 Sessão compartilhada com subaplicações");
      }
    } else {
      console.log("🔒 Nenhum usuário autenticado");
      window.__RELEVO_USER_LOGGED__ = false;
    }
  });

  // Se o usuário já estava logado antes do onAuthStateChanged ativar
  const current = auth.currentUser;
  if (current && !window.relevoUser) {
    window.relevoUser = current;
    console.log("⚡ Sessão restaurada:", current.email || current.uid);
  }
} else {
  console.warn("⚠️ Firebase Auth ainda não disponível para monitoramento global.");
}
