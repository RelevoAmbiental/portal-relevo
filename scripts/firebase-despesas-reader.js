/* global firebase */
// ===========================================================
// 🔥 FIREBASE READER - Dashboard de Despesas (somente leitura)
// Projeto secundário: app-despesas-7029f
// Mantém instância isolada para não conflitar com o portal.
// ===========================================================
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
    // Instância separada para leitura no dashboard
    const despesasReaderApp =
      firebase.apps.find(a => a.name === "despesasReader") ||
      firebase.initializeApp(despesasConfig, "despesasReader");

    window.dbDespesas = despesasReaderApp.firestore();  
    window.storageDespesas = despesasReaderApp.storage();

    // (Opcional) cache offline para o dashboard
    window.dbDespesas.enablePersistence({ synchronizeTabs: true }).catch(() => {});

    console.log("✅ Firebase Reader (Despesas) inicializado para leitura");
  } catch (error) {
    console.error("❌ Erro ao inicializar Reader de Despesas:", error);
  }
})();
