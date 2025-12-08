/* ============================================================
   Firebase Functions – Portal Relevo
   Versão com SECRET OPENAI_API_KEY + CORS CORPORATIVO CORRIGIDO
   ============================================================ */

const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");

// Secret Manager
const OPENAI_KEY = defineSecret("OPENAI_API_KEY");

// Importações internas
const { extrairArquivo } = require("./src/ai-extrair");
const { interpretarTexto } = require("./src/ai-interpretar");
const { gerarCronograma } = require("./src/ai-cronograma");

/* ============================================================
   CORS DEFINITIVO — Resolve 100% bloqueios entre domínio e Cloud Functions
   ============================================================ */

function withCors(handler) {
  return async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      await handler(req, res);
    } catch (err) {
      console.error("Erro interno:", err);
      res.status(500).json({ error: "Erro interno do servidor." });
    }
  };
}

/* ============================================================
   1) interpretarArquivo — upload + OCR + IA
   ============================================================ */
exports.interpretarArquivo = functions
  .region("us-central1")
  .runWith({ secrets: [OPENAI_KEY] })
  .https.onRequest(
    withCors(async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
      }

      let texto = "";
      try {
        texto = await extrairArquivo(req);
      } catch (e) {
        console.error("Erro ao extrair arquivo:", e);
        return res.status(500).json({ error: "Falha ao extrair arquivo." });
      }

      if (!texto || texto.trim() === "") {
        return res.status(400).json({ error: "Nenhum texto extraído" });
      }

      let tarefas = [];
      try {
        tarefas = await interpretarTexto(texto);
      } catch (e) {
        console.error("Erro IA:", e);
        return res.status(500).json({ error: "Falha ao interpretar texto." });
      }

      return res.json({
        texto,
        tarefas,
      });
    })
  );

/* ============================================================
   2) gerarCronograma — lógica IA (se usada) + planificação
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
        return res.status(500).json({ error: err.message });
      }
    })
  );
