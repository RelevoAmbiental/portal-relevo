/* ============================================================
   Firebase Functions – Portal Relevo
   Versão com SECRET OPENAI_API_KEY + CORS ajustado
   ============================================================ */

const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { defineSecret } = require("firebase-functions/params");

// Secret do OpenAI no Secret Manager
const OPENAI_KEY = defineSecret("OPENAI_API_KEY");

// Importações internas
const { extrairArquivo } = require("./src/ai-extrair");
const { interpretarTexto } = require("./src/ai-interpretar");
const { gerarCronograma } = require("./src/ai-cronograma");

/* ============================================================
   Middleware CORS genérico
   ============================================================ */
function withCors(handler) {
  return (req, res) => {
    cors(req, res, () => {
      // Garante cabeçalho de origem
      res.set("Access-Control-Allow-Origin", "https://portal.relevo.eco.br");
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

      // Pré-flight
      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      return handler(req, res);
    });
  };
}

/* ============================================================
   1) interpretarArquivo — upload + OCR + interpretação IA
   ============================================================ */
exports.interpretarArquivo = functions
  .region("us-central1")
  .runWith({ secrets: [OPENAI_KEY] }) // habilita OPENAI_API_KEY
  .https.onRequest(
    withCors(async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }

      try {
        // 1) extrai texto do arquivo
        const textoExtraido = await extrairArquivo(req);

        if (!textoExtraido || textoExtraido.trim() === "") {
          return res.status(400).json({ error: "Nenhum texto extraído" });
        }

        // 2) manda para a IA montar as tarefas
        const tarefas = await interpretarTexto(textoExtraido);

        // 3) retorno padrão da API
        return res.json({
          texto: textoExtraido,
          tarefas,
        });
      } catch (err) {
        console.error("Erro interpretarArquivo:", err);
        return res.status(500).json({ error: err.message || "Erro interno" });
      }
    })
  );

/* ============================================================
   2) gerarCronograma — montagem final estruturada
   ============================================================ */
exports.gerarCronograma = functions
  .region("us-central1")
  .runWith({ secrets: [OPENAI_KEY] }) // fica pronto se um dia usar IA aqui também
  .https.onRequest(
    withCors(async (req, res) => {
      try {
        const estrutura = req.body;
        const resultado = await gerarCronograma(estrutura);
        return res.json(resultado);
      } catch (err) {
        console.error("Erro gerarCronograma:", err);
        return res.status(500).json({ error: err.message || "Erro interno" });
      }
    })
  );
