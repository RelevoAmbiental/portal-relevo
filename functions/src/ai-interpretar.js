/* ============================================================
   IA — Interpretar texto e gerar tarefas estruturadas
   Inicializa OpenAI SOMENTE dentro da função (evita erro no deploy)
   ============================================================ */

const OpenAI = require("openai");

exports.interpretarTexto = async (texto) => {
  // Inicializa a OpenAI APENAS em runtime (não no build!)
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `
Você é um planejador sênior da Relevo Consultoria Ambiental.
Sua missão é transformar o texto a seguir em uma lista de tarefas estruturadas.

REQUISITOS:
1) Identifique tarefas, etapas, produtos e responsáveis.
2) Use datas explícitas sempre que existirem.
3) Quando não houver datas → estimar datas relativas (+N dias).
4) Classificar cada tarefa em:
   - ENTREGÁVEL
   - PRODUÇÃO
   - EMISSÃO_DE_NOTA
   - RECEBÍVEL
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
6) Retorne somente um array JSON puro.

TEXTO:
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
