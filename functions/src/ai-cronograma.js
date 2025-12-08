/* ============================================================
   IA – Pós-processamento de estrutura de cronograma
   (Por enquanto básico — pronto para evoluir)
   ============================================================ */

exports.gerarCronograma = async (estrutura) => {
  return {
    ...estrutura,
    status: "processado",
    geradoEm: new Date().toISOString(),
  };
};
