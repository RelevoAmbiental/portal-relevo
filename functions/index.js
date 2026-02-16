const functions = require("firebase-functions/v1");
const cors = require("cors")({ origin: true });
const { defineSecret } = require("firebase-functions/params");

const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

const OPENAI_KEY = defineSecret("OPENAI_API_KEY");

const { extrairArquivo, extrairTextoDeBuffer } = require("./src/ai-extrair");
const { interpretarTexto } = require("./src/ai-interpretar");
const { gerarCronograma } = require("./src/ai-cronograma");

/* ============================================================
   Middleware CORS genérico (mantido pro gerarCronograma HTTP)
   ============================================================ */
function withCors(handler) {
  return (req, res) => {
    cors(req, res, () => {
      res.set("Access-Control-Allow-Origin", "https://portal.relevo.eco.br");
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      return handler(req, res);
    });
  };
}

/* ============================================================
   1) interpretarArquivo — ✅ Callable (Auth obrigatório)
   Front chama via httpsCallable("interpretarArquivo")
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

    // hard stop: evita payload gigante no callable
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

      return {
        texto: textoExtraido,
        tarefas,
      };
    } catch (err) {
      console.error("Erro interpretarArquivo (callable):", err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Erro interno"
      );
    }
  });

/* ============================================================
   2) gerarCronograma — HTTP (mantido)
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

/* ============================================================
   3) gerarInstanciasRecorrentes — Scheduler (MVP)
   ============================================================ */
function toYmd(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// PT-BR: SEG, TER, QUA, QUI, SEX, SAB, DOM
const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

exports.gerarInstanciasRecorrentes = functions
  .region("us-central1")
  .pubsub.schedule("every day 03:15")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const db = admin.firestore();

    const hoje = new Date();
    const horizonteDias = 75;
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fim = addDays(inicio, horizonteDias);

    const snap = await db
      .collection("tarefas_modelos")
      .where("ativo", "==", true)
      .get();

    if (snap.empty) return null;

    let batch = db.batch();
    let ops = 0;

    async function commitIfNeeded(force = false) {
      if (ops === 0) return;
      if (!force && ops < 450) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }

    for (const doc of snap.docs) {
      const m = doc.data();
      const modeloId = doc.id;

      const tipo = String(m?.recorrencia?.tipo || "SEM_RECORRENCIA").toUpperCase();
      if (tipo === "SEM_RECORRENCIA") continue;

      const projetoId = m.projetoId;
      const uid = m.uid;
      const titulo = m.titulo;
      if (!projetoId || !uid || !titulo) continue;

      for (let d = new Date(inicio); d <= fim; d = addDays(d, 1)) {
        let gera = false;

        if (tipo === "DIARIO") gera = true;

        if (tipo === "SEMANAL") {
          const alvo = String(m?.recorrencia?.diaSemana || "").toUpperCase();
          if (alvo && DOW[d.getDay()] === alvo) gera = true;
        }

        if (tipo === "MENSAL") {
          const diaMes = Number(m?.recorrencia?.diaMes);
          if (Number.isFinite(diaMes) && d.getDate() === diaMes) gera = true;
        }

        if (!gera) continue;

        const ymd = toYmd(d);
        const instanceKey = `${modeloId}_${ymd}`;
        const ref = db.collection("tarefas").doc(instanceKey);

        batch.set(
          ref,
          {
            instanceKey,
            modeloId,

            projetoId,
            uid,

            titulo: String(titulo),
            descricao: String(m?.descricao || ""),
            responsavel: String(m?.responsavel || ""),
            prioridade: String(m?.prioridade || "MEDIA"),
            status: "A_FAZER",
            tags: Array.isArray(m?.tags) ? m.tags : [],
            subtarefas: Array.isArray(m?.subtarefas) ? m.subtarefas : [],

            dataInicio: admin.firestore.Timestamp.fromDate(new Date(d)),
            dataVencimento: admin.firestore.Timestamp.fromDate(new Date(d)),

            arquivado: false,
            arquivadaMotivo: null,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdByUid: "scheduler",
            updatedByUid: "scheduler",
          },
          { merge: true }
        );

        ops++;
        await commitIfNeeded(false);
      }
    }

    await commitIfNeeded(true);
    return null;
  });
