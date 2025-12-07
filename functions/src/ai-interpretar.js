/* ============================================================
   IA — Interpretar texto e gerar tarefas estruturadas
   Usa Secret Manager → process.env.OPENAI_API_KEY
   ============================================================ */

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY  // <── agora funciona no Firebase!
});

exports.interpretarTexto = async (texto) => {
  const prompt = `
Você é um planejador sênior da Relevo Consultoria Ambiental.
Sua missão é transformar o texto a seguir em uma lista de tarefas estruturadas.

REQUISITOS:

1) Identifique tarefas, etapas, atividades e produtos.
2) Sempre que existir DATA explícita → usar a data.
3) Se não existir data:
   - inferir ordem lógica
   - estimar datas relativas (ex: +5 dias)
4) Classificar cada tarefa em UMA das categorias:
   - ENTREGÁVEL (produto final)
   - PRODUÇÃO (atividade técnica ou de campo)
   - EMISSÃO_DE_NOTA
   - RECEBÍVEL (momento de pagamento)
5) Cada tarefa deve ter:
{
  "nome": "",
  "descricao": "",
  "categoria": "",
  "produto": "",
  "responsavel": "",
  "inicioRelativoDias": número,
  "duracaoDias": número
}
6) Retorne SOMENTE um array JSON puro.
7) NÃO inclua explicações, comentários ou texto fora do JSON.

TEXTO A INTERPRETAR:
========================================
${texto}
========================================
`;

  const completion = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt
  });

  const jsonStr = completion.output_text.trim();
  return JSON.parse(jsonStr);
};
