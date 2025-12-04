// ======================================================================
// firebase-app.js
// ----------------------------------------------------------------------
// Este arquivo existe apenas por legado. O Portal usa Firebase compat
// carregado diretamente no index.html. O Cronograma usa Firebase v10
// dentro do próprio bundle React, sem depender deste arquivo.
//
// Portanto NÃO inicializamos Firebase aqui.
//
// Mantemos apenas logs para depuração e para evitar erros de referência.
// ======================================================================

(() => {
  console.log("[Portal] firebase-app.js carregado (modo legado).");

  // Garante que variáveis globais existam (evita erros de leitura)
  window.__RELEVO_FIREBASE__ ??= undefined;
  window.__RELEVO_AUTH__ ??= undefined;
  window.__RELEVO_DB__ ??= undefined;
  window.__RELEVO_USER__ ??= undefined;

})();
