const express = require("express");
const { GoogleAuth } = require("google-auth-library");

const app = express();
const port = process.env.PORT || 8080;

// ============================
// Config
// ============================
const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN || "https://portal.relevo.eco.br";
const FUNCTION_URL =
  process.env.INTERPRETAR_URL ||
  "https://us-central1-portal-relevo.cloudfunctions.net/interpretarArquivo";

// JSON body (requests vindos do Portal via API Gateway)
app.use(express.json({ limit: "15mb" }));

// CORS (Portal)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", PORTAL_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  if (req.method === "OPTIONS") return res.status(204).send("");
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "gateway-ia",
    mode: "prod",
    functionUrl: FUNCTION_URL,
    ts: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.status(200).send("gateway-ia online");
});

// ============================
// POST /interpretarArquivo
// - recebe base64 (do Portal)
// - gera Identity Token IAM (audience = FUNCTION_URL)
// - chama Cloud Function private (IAM)
// - devolve o JSON da Function
// ============================
app.post("/interpretarArquivo", async (req, res) => {
  try {
    const body = req.body || {};

    // Diagnóstico rápido: quais chaves chegaram?
    console.log("interpretarArquivo body keys:", Object.keys(body));

    // Aceita formato novo e legado
    const fileBase64 = body.fileBase64 || body.contentBase64 || null;
    const mimeType =
      body.mimeType || body.contentType || "application/octet-stream";
    const fileName = body.fileName || body.filename || null;

    if (
      !fileBase64 ||
      typeof fileBase64 !== "string" ||
      fileBase64.trim().length === 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "missing_payload",
        message: "Envie 'fileBase64' (ou 'contentBase64' legado) no corpo da requisição.",
      });
    }

    // Identity Token para invocar Function privada (IAM)
    const auth = new GoogleAuth();
    const idClient = await auth.getIdTokenClient(FUNCTION_URL);
    const iamHeaders = await idClient.getRequestHeaders();

    const payload = { fileBase64, mimeType, fileName };

    const resp = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        ...iamHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = { raw };
    }

    return res.status(resp.status).json(json);
  } catch (err) {
    console.error("interpretarArquivo error:", err);
    return res.status(500).json({
      ok: false,
      error: "internal_error",
      message: err?.message || "Falha interna no gateway-ia.",
    });
  }
});

app.listen(port, () => {
  console.log(`gateway-ia listening on port ${port}`);
  console.log(`FUNCTION_URL=${FUNCTION_URL}`);
  console.log(`PORTAL_ORIGIN=${PORTAL_ORIGIN}`);
});
