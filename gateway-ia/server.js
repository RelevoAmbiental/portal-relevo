const express = require("express");

const app = express();
const port = process.env.PORT || 8080;

// JSON body (para requests vindos do Portal via API Gateway)
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "gateway-ia",
    ts: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.status(200).send("gateway-ia online");
});

// Endpoint principal do Cronograma (stub inicial)
app.post("/interpretarArquivo", async (req, res) => {
  try {
    const body = req.body || {};

    const hasText =
      typeof body.text === "string" && body.text.trim().length > 0;
    const hasB64 =
      typeof body.contentBase64 === "string" &&
      body.contentBase64.trim().length > 0;

    if (!hasText && !hasB64) {
      return res.status(400).json({
        ok: false,
        error: "missing_payload",
        message: "Envie 'text' ou 'contentBase64' no corpo da requisição.",
      });
    }

    return res.status(200).json({
      ok: true,
      mode: hasText ? "text" : "base64",
      received: {
        textLength: hasText ? body.text.length : 0,
        base64Length: hasB64 ? body.contentBase64.length : 0,
        filename: body.filename || null,
        meta: body.meta || null,
      },
      result: {
        summary: "Stub ativo. Próximo passo: integrar IA.",
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error("interpretarArquivo error:", err);
    return res.status(500).json({
      ok: false,
      error: "internal_error",
      message: "Falha interna no gateway-ia.",
    });
  }
});

app.listen(port, () => {
  console.log(`gateway-ia listening on port ${port}`);
});
