<script type="module">
/********************************************************************
 * 🔒 WRAPPER SEGURO (IIFE)
 * Isola todo o script em um escopo fechado, evita leaks globais
 * e permite “return” de forma segura, sem warnings do VS Code.
 ********************************************************************/
(() => {

  /********************************************************************
   * 🔒 PROTEÇÃO ATUALIZADA (2025-12)
   *
   * Antes: o portal bloqueava o carregamento do Firebase quando a rota
   * era /cronograma/, porque o módulo antigo usava Firebase compat v9.
   *
   * Agora: o cronograma foi unificado ao portal e DEPENDE do Firebase
   * v10 daqui. Portanto, NUNCA devemos impedir a inicialização.
   *
   * Mantemos apenas o log para auditoria.
   ********************************************************************/
  if (location.pathname.startsWith("/cronograma")) {
    console.log("[Portal] Firebase será carregado normalmente dentro de /cronograma.");
    // Nenhum return aqui — Firebase deve iniciar sempre.
  }

  /********************************************************************
   * 🔥 Firebase v10 (modular)
   * Este bloco continua funcionando normalmente para:
   * - despesas
   * - inventário
   * - orçamento
   * - colaboradores
   * - gestão interna
   * - clientes
   * - cronograma (NOVO)
   ********************************************************************/
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

  console.log("[Portal] Inicializando Firebase v10 (modular)…");

  // 🔧 Configurações do app principal do Portal
  const firebaseConfig = {
    apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
    authDomain: "portal-relevo.firebaseapp.com",
    projectId: "portal-relevo",
    storageBucket: "portal-relevo.appspot.com",
    messagingSenderId: "182759626683",
    appId: "1:182759626683:web:2dde2eeef910d4c288569e"
  };

  // 🚀 Inicializa o app
  const app = initializeApp(firebaseConfig);

  // 🚀 Inicializa Auth + Firestore
  const auth = getAuth(app);
  const db = getFirestore(app);

  // 🔄 Expõe bootstrapping global do portal
  window.__RELEVO_FIREBASE__ = app;
  window.__RELEVO_AUTH__ = auth;
  window.__RELEVO_DB__ = db;

  console.log("[Portal] Firebase v10 carregado e exposto globalmente.");

  /********************************************************************
   * 🔄 Controle de sessão global (user)
   * Usado por todas as telas internas do portal, incluindo /cronograma/.
   ********************************************************************/
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("[Portal] Usuário autenticado:", user.email);

      window.__RELEVO_USER__ = {
        uid: user.uid,
        email: user.email,
        provider: user.providerId,
        raw: user
      };

    } else {
      console.warn("[Portal] Nenhum usuário autenticado.");
      window.__RELEVO_USER__ = null;
    }
  });

})(); // ← Fim da IIFE segura
</script>
