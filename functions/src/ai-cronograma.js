exports.gerarCronograma = async (estrutura) => {
  const cronograma = [];

  let dataAtual = new Date();
  for (const etapa of estrutura.etapas) {
    const inicio = new Date(dataAtual);
    const fim = new Date(dataAtual);
    fim.setDate(fim.getDate() + etapa.duracaoDias);

    cronograma.push({
      etapa: etapa.nome,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      atividades: etapa.atividades
    });

    dataAtual = new Date(fim);
  }

  return cronograma;
};
