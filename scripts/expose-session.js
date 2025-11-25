// ============================================
//   EXPOSE SESSION — seguro e sem colisões
// ============================================

(function () {

  // Se Firebase ainda não foi inicializado, aborta
  if (!window.__RELEVO_FIREBASE__) {
    console.warn("⚠️ Firebase não inicializado ainda — sessão não exposta.");
    return;
  }

  const auth = window.__RELEVO_FIREBASE__.auth();

  // Guarda o usuário logado globalmente
  auth.onAuthStateChanged((user) => {
    if (!user) {
      console.log("⚠️ Nenhum usuário logado.");
      window.__RELEVO_USER__ = null;
      return;
    }

    console.log("✅ Usuário exposto globalmente:", user.email);

    window.__RELEVO_USER__ = {
      uid: user.uid,
      email: user.email,
      provider: user.providerData[0]?.providerId || "unknown",
      raw: user
    };
  });

})();
