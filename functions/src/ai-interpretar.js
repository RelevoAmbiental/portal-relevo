const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.interpretarTexto = async (texto) => {
  const prompt = `
Você é um planejador sênior da Relevo Consultoria Ambiental.
Transforme o texto abaixo em uma lista JSON de tarefas:

Cada tarefa deve ter:
{
 "nome": "",
 "descricao": "",
 "categoria": "",
 "produto": "",
 "responsavel": "",
 "inicioRelativoDias": número,
 "duracaoDias": número
}

Retorne SOMENTE o JSON, sem comentários.

TEXTO:
${texto}
  `;

  const completion = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const jsonStr = completion.output_text.trim();
  return JSON.parse(jsonStr);
};
