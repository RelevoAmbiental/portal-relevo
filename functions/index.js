/* ============================================================
   Firebase Functions – Portal Relevo
   Versão com SECRET OPENAI_API_KEY integrado
   ============================================================ */

const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { defineSecret } = require("firebase-functions/params");

// Carrega Secret Manager
const OPENAI_KEY = defineSecret("OPENAI_API_KEY");

// Importações internas
const { extrairArquivo } = require("./src/ai-extrair");
const { interpretarTexto } = require("./src/ai-interpretar");
const { gerarCronograma } = require("./src/ai-cronograma");

// Middleware CORS
function withCors(handler) {
  return (req, res) => {
    cors(req, res, () => handler(req, res));
  };
}

/* ============================================================
   1) interpretarArquivo — upload + OCR + interpretação IA
   ============================================================ */
exports.interpretarArquivo = functions
  .region("us-central1")
  .runWith({ secrets: [OPENAI_KEY] }) // <── habilita OPENAI_API_KEY
  .https.onRequest(
    withCors(async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }

      try {
        const textoExtraido = await extrairArquivo(req);

        if (!textoExtraido || textoExtraido.trim() === "") {
          return res.status(400).json({ error: "Nenhum texto extraído" });
        }

        const tarefas = await interpretarTexto(textoExtraido);

        return res.json({ texto: textoExtraido, tarefas });
      } catch (err) {
        console.error("Erro interpretarArquivo:", err);
        return res.status(500).json({ error: err.message });
      }
    })
  );

/* ============================================================
   2) gerarCronograma — montagem final estruturada
   ============================================================ */
exports.gerarCronograma = functions
  .region("us-central1")
  .runWith({ secrets: [OPENAI_KEY] }) // (necessário se usar IA dentro dele)
  .https.onRequest(
    withCors(async (req, res) => {
      try {
        const estrutura = req.body;
        const resultado = await gerarCronograma(estrutura);
        res.json(resultado);
      } catch (err) {
        console.error("Erro gerarCronograma:", err);
        res.status(500).json({ error: err.message });
      }
    })
  );
