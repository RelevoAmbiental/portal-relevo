/* ============================================================
   IA – interpretar texto extraído em tarefas estruturadas
   Usa Secret do OpenAI
   ============================================================ */

const OpenAI = require("openai");
const { defineSecret } = require("firebase-functions/params");

// Secret Manager: OPENAI_API_KEY
const OPENAI_KEY = defineSecret("OPENAI_API_KEY");

// cria cliente somente quando necessário
function getClient() {
  return new OpenAI({
    apiKey: OPENAI_KEY.value(),
  });
}

exports.interpretarTexto = async (texto) => {
  const client = getClient();

  const prompt = `
Você é um planejador sênior da Relevo Consultoria Ambiental.
Transforme o texto abaixo em uma lista JSON de tarefas estruturadas.

Cada tarefa deve ter:
{
 "nome": "",
 "descricao": "",
 "categoria": "",        // ENTREGÁVEL, PRODUÇÃO, EMISSAO_DE_NOTA, RECEBÍVEL
 "produto": "",
 "responsavel": "",
 "inicioRelativoDias": número,
 "duracaoDias": número
}

Se houver datas explícitas → respeite.
Se não houver → estime datas relativas e mantenha coerência lógica.

Retorne SOMENTE o JSON.

TEXTO:
${texto}
  `;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const jsonStr = response.output_text.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Erro ao interpretar JSON retornado pela IA:", jsonStr);
    throw new Error("A IA retornou um JSON inválido.");
  }
};
