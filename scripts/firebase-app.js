/********************************************************************
 * firebase-app.js  —  MODO LEGADO SEGURO
 * ---------------------------------------------------------------
 * Este arquivo existia historicamente como inicializador Firebase.
 * Hoje, toda inicialização REAL acontece em:
 *
 *   - index.html  (Firebase compat v9)
 *   - cronograma bundle (Firebase modular v10)
 *
 * Portanto: este arquivo NÃO inicializa Firebase.
 * Ele existe apenas para manter compatibilidade estrutural e garantir
 * que o GitHub Pages encontre um artefato válido.
 ********************************************************************/

(() => {
  console.log("[Portal] firebase-app.js carregado (modo legado).");

  /**************************************************************
   * Garante que variáveis globais existam, evitando erros
   * em páginas antigas ou scripts que esperam estas chaves.
   **************************************************************/
  if (typeof window !== "undefined") {
    window.__RELEVO_FIREBASE__ = window.__RELEVO_FIREBASE__ ?? null;
    window.__RELEVO_AUTH__     = window.__RELEVO_AUTH__     ?? null;
    window.__RELEVO_DB__       = window.__RELEVO_DB__       ?? null;
    window.__RELEVO_USER__     = window.__RELEVO_USER__     ?? null;
  }

  /**************************************************************
   * Bloco meramente documental — não executa nada.
   * Serve apenas para manter o arquivo com tamanho adequado,
   * evitando bloqueios de deploy no GitHub Pages.
   **************************************************************/
  const _doc = {
    version: "legacy-wrapper-2025-12",
    purpose: "compat-layer-only",
    firebaseControlledElsewhere: true,
    notes: [
      "Toda a inicialização Firebase compat v9 ocorre em index.html.",
      "Cronograma usa Firebase modular v10 dentro do bundle React.",
      "Este arquivo NÃO deve inicializar nada.",
      "Serve apenas como placeholder seguro e estável."
    ]
  };

  console.debug("[Portal] firebase-app.js — metadata:", _doc);
})();
