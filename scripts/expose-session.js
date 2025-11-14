// scripts/expose-session.js
// Expor sessão do usuário logado para apps como /cronogramas/

(function () {
  const auth = window.__RELEVO_AUTH__;  // já inicializado pelo guard
  const db = window.__RELEVO_DB__;

  if (!auth || !db) {
    console.error("❌ Firebase não carregou no Portal antes do expose-session.");
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      localStorage.removeItem("relevoSession");
      return;
    }

    try {
      const snap = await db.collection("users").doc(user.uid).get();
      const userData = snap.exists ? snap.data() : {};

      const safeSession = {
        uid: user.uid,
        email: user.email,
        tipo: userData.tipo || null,   // gestao / cliente / colaborador
        projeto: userData.projeto || null,
      };

      localStorage.setItem("relevoSession", JSON.stringify(safeSession));

    } catch (err) {
      console.error("❌ Erro ao expor sessão:", err);
    }
  });
})();
