/********************************************************************
 * 🔒 WRAPPER SEGURO (IIFE)
 ********************************************************************/
(() => {

  /********************************************************************
   * 🔒 PROTEÇÃO ATUALIZADA (2025-12)
   ********************************************************************/
  if (location.pathname.startsWith("/cronograma")) {
    console.log("[Portal] Firebase será carregado normalmente dentro de /cronograma.");
  }

  /********************************************************************
   * 🔥 Firebase v10 (modular)
   ********************************************************************/
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

  console.log("[Portal] Inicializando Firebase v10 (modular)…");

  const firebaseConfig = {
    apiKey: "AIzaSyBcQi5nToMOGVDBWprhhOY0NSJX4qE100w",
    authDomain: "portal-relevo.firebaseapp.com",
    projectId: "portal-relevo",
    storageBucket: "portal-relevo.appspot.com",
    messagingSenderId: "182759626683",
    appId: "1:182759626683:web:2dde2eeef910d4c288569e"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  window.__RELEVO_FIREBASE__ = app;
  window.__RELEVO_AUTH__ = auth;
  window.__RELEVO_DB__ = db;

  console.log("[Portal] Firebase v10 carregado e exposto globalmente.");

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

})();
