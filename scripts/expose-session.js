// =======================================================================
//  EXPOSE SESSION — expõe a sessão global de forma segura e sincronizada
// =======================================================================

(function () {
  if (typeof window === "undefined") return;

  function esperarFirebase() {
    return new Promise((resolve) => {
      if (window.__RELEVO_AUTH__) return resolve(window.__RELEVO_AUTH__);

      const timer = setInterval(() => {
        if (window.__RELEVO_AUTH__) {
          clearInterval(timer);
          resolve(window.__RELEVO_AUTH__);
        }
      }, 50);
    });
  }

  async function iniciar() {
    const auth = await esperarFirebase();

    if (!auth) {
      console.error("❌ expose-session.js: Auth indisponível.");
      return;
    }

    auth.onAuthStateChanged((user) => {
      if (!user) {
        console.log("⚠️ Nenhum usuário logado.");
        window.__RELEVO_USER__ = null;
        return;
      }

      window.__RELEVO_USER__ = {
        uid: user.uid,
        email: user.email,
        provider: user.providerData?.[0]?.providerId ?? "unknown",
        raw: user
      };

      console.log("✅ Usuário exposto globalmente:", user.email);
    });
  }

  iniciar();
})();
