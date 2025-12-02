<script type="module">
  /********************************************************************
   * 🔒 PROTEÇÃO CRÍTICA
   * Evita inicializar o Firebase modular v10 dentro do Cronograma,
   * pois o cronograma usa Firebase v9 compat e depende do Guard.
   ********************************************************************/
  if (location.pathname.startsWith("/cronograma")) {
    console.log("[Portal] Ignorando firebase-app.js dentro do Cronograma.");

    // Garante que nada seja sobrescrito indevidamente
    window.__RELEVO_FIREBASE__ ||= undefined;
    window.__RELEVO_AUTH__ ||= undefined;
    window.__RELEVO_DB__ ||= undefined;

    // NÃO carregar Firebase v10 aqui
    return;
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
   * - etc.
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
   * Usado por várias telas do portal.
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
</script>
