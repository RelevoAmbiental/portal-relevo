// ===========================================================
// 🔥 FIREBASE CONFIG - Aplicação de Despesas (Relevo Consultoria Ambiental)
// ===========================================================
//
// Este app usa um projeto Firebase separado do portal principal.
// Ele é independente e não precisa de autenticação.
// ===========================================================

/* global firebase */

(function () {
  const despesasConfig = {
    apiKey: "AIzaSyCDIrPqQs7S_E2UeDGPNeFCVYcv09JFoTs",
    authDomain: "app-despesas-7029f.firebaseapp.com",
    projectId: "app-despesas-7029f",
    storageBucket: "app-despesas-7029f.firebasestorage.app",
    messagingSenderId: "843931176271",
    appId: "1:843931176271:web:5cdafdd10bc28c3bd8893a"
  };

  try {
    // Inicializa com nome isolado para não conflitar com o portal
    const despesasApp = firebase.apps.find(a => a.name === "despesasApp")
      || firebase.initializeApp(despesasConfig, "despesasApp");

    console.log("✅ Firebase (App de Despesas) inicializado com sucesso");
    console.log("📦 Projeto:", despesasConfig.projectId);

    // Serviços isolados
    window.db = despesasApp.firestore();
    window.storage = despesasApp.storage();

    // ============================================================
    // Habilita persistência offline
    // ============================================================
    window.db.enablePersistence({ synchronizeTabs: true })
      .then(() => console.log("✅ Persistência offline habilitada"))
      .catch((err) => {
        if (err.code === "failed-precondition") {
          console.warn("⚠️ Persistência não habilitada: múltiplas abas abertas");
        } else if (err.code === "unimplemented") {
          console.warn("⚠️ Persistência não suportada neste navegador");
        } else {
          console.error("❌ Erro ao habilitar persistência:", err);
        }
      });

    // ============================================================
    // Configurações de storage (upload)
    // ============================================================
    window.storageConfig = {
      maxFileSize: 10 * 1024 * 1024, // 10 MB
      acceptedTypes: ["image/jpeg", "image/png", "image/jpg", "application/pdf"],
      uploadPath: "comprovantes/"
    };

    // ============================================================
    // Eventos de rede
    // ============================================================
    window.addEventListener("online", () => {
      console.log("🌐 Conexão restaurada");
      window.db.enableNetwork()
        .then(() => console.log("✅ Firestore online"))
        .catch(err => console.error("❌ Erro ao reconectar Firestore:", err));
    });

    window.addEventListener("offline", () => {
      console.warn("📴 Sem conexão - Modo offline ativado");
      window.db.disableNetwork()
        .then(() => console.log("ℹ️ Firestore em modo offline"))
        .catch(err => console.error("❌ Erro ao desconectar Firestore:", err));
    });

    console.log("🎯 Firebase (App de Despesas) pronto para uso!");

  } catch (error) {
    console.error("❌ Erro ao inicializar Firebase (Despesas):", error);
    alert("Erro ao conectar com o servidor. Recarregue a página.");
  }
})();
