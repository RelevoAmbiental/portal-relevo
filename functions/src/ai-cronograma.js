exports.gerarCronograma = async (estrutura) => {
  return {
    ...estrutura,
    status: "processado",
    timestamp: Date.now()
  };
};
