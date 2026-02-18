const functions = require("firebase-functions/v1");
const cors = require("cors")({ origin: true });
const { defineSecret } = require("firebase-functions/params");

const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

const OPENAI_KEY = defineSecret("OPENAI_API_KEY");

const { extrairTextoDeBuffer } = require("./src/ai-extrair");
const { interpretarTexto } = require("./src/ai-interpretar");
const { gerarCronograma } = require("./src/ai-cronograma");

/* ============================================================
   Middleware CORS (mantido pro gerarCronograma HTTP)
   ============================================================ */
function withCors(handler) {
  return (req, res) => {
    cors(req, res, () => {
      res.set("Access-Control-Allow-Origin", "https://portal.relevo.eco.br");
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

      if (req.method === "OPTIONS") return res.status(204).send("");
      return handler(req, res);
    });
  };
}

/* ============================================================
   interpretarArquivo — HTTP (IAM private) + JSON (sem multipart)
   Body esperado: { fileBase64, mimeType, fileName }
   ============================================================ */
exports.interpretarArquivo = functions
  .region("us-central1")
  .runWith({ secrets: [OPENAI_KEY], invoker: "private" })
  .https.onRequest(
    withCors(async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }

      try {
        const { fileBase64, mimeType, fileName } = req.body || {};

        if (!fileBase64 || typeof fileBase64 !== "string") {
          return res.status(400).json({ error: "Envie { fileBase64, mimeType }" });
        }

        const buffer = Buffer.from(fileBase64, "base64");
        const textoExtraido = await extrairTextoDeBuffer(
          buffer,
          mimeType || "application/octet-stream",
          fileName
        );

        if (!textoExtraido || textoExtraido.trim() === "") {
          return res.status(400).json({ error: "Nenhum texto extraído" });
        }

        const tarefas = await interpretarTexto(textoExtraido);

        return res.json({ texto: textoExtraido, tarefas });
      } catch (err) {
        console.error("Erro interpretarArquivo (http/json):", err);
        return res.status(500).json({ error: err?.message || "Erro interno" });
      }
    })
  );

/* ============================================================
   gerarCronograma — HTTP (mantido)
   ============================================================ */
exports.gerarCronograma = functions
  .region("us-central1")
  .runWith({ secrets: [OPENAI_KEY] })
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
