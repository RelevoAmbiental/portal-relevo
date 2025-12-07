const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// Importações internas
const { extrairArquivo } = require("./src/ai-extrair");
const { interpretarTexto } = require("./src/ai-interpretar");
const { gerarCronograma } = require("./src/ai-cronograma");

// Wrapper CORS
function withCors(handler) {
  return (req, res) => {
    cors(req, res, () => handler(req, res));
  };
}

// ======================================================
// 1) interpretador IA — upload + extração + interpretação
// ======================================================
exports.interpretarArquivo = functions
  .region("us-central1")
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

// ======================================================
// 2) gerarCronograma — lógica modular
// ======================================================
exports.gerarCronograma = functions
  .region("us-central1")
  .https.onRequest(
    withCors(async (req, res) => {
      try {
        const estrutura = req.body;
        const resultado = await gerarCronograma(estrutura);
        res.json(resultado);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
      }
    })
  );
