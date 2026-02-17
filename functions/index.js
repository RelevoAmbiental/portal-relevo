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
   interpretarArquivo — ✅ Callable (Auth obrigatório)
   Payload: { fileBase64, mimeType, fileName }
   ============================================================ */
exports.interpretarArquivo = functions
  .region("us-central1")
  .runWith({ secrets: [OPENAI_KEY] })
  .https.onCall(async (data, context) => {
    if (!context?.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Você precisa estar autenticado para usar a Importação IA."
      );
    }

    const fileBase64 = data?.fileBase64;
    const mimeType = data?.mimeType || "application/octet-stream";

    if (!fileBase64 || typeof fileBase64 !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Envie {fileBase64, mimeType}."
      );
    }

    if (fileBase64.length > 9_000_000) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Arquivo muito grande para importação direta. Compacte/reduza ou divida o arquivo."
      );
    }

    try {
      const buffer = Buffer.from(fileBase64, "base64");
      const textoExtraido = await extrairTextoDeBuffer(buffer, mimeType);

      if (!textoExtraido || textoExtraido.trim() === "") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Nenhum texto extraído do arquivo."
        );
      }

      const tarefas = await interpretarTexto(textoExtraido);
      return { texto: textoExtraido, tarefas };
    } catch (err) {
      console.error("Erro interpretarArquivo (callable):", err);
      throw new functions.https.HttpsError("internal", err?.message || "Erro interno");
    }
  });

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
