/* ============================================================
   IA – EXTRAÇÃO DE TEXTO DO ARQUIVO (PDF, DOCX, TXT)
   - Suporta upload multipart via Busboy (HTTP)
   - Suporta extração a partir de Buffer (Callable)
   ============================================================ */

const Busboy = require("busboy");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

async function extrairTextoDeBuffer(fileBuffer, mimetype = "") {
  const mt = String(mimetype || "").toLowerCase();

  if (mt.includes("pdf")) {
    const pdf = await pdfParse(fileBuffer);
    return pdf.text || "";
  }

  if (mt.includes("word") || mt.includes("docx")) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value || "";
  }

  // fallback: texto puro
  return fileBuffer.toString("utf8");
}

exports.extrairTextoDeBuffer = extrairTextoDeBuffer;

exports.extrairArquivo = (req) =>
  new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });

    let fileBuffer = Buffer.from([]);
    let mimetype = "";
    let fileFound = false;

    busboy.on("file", (fieldname, file, info) => {
      if (fieldname !== "file") {
        console.warn("Campo diferente de 'file' enviado:", fieldname);
      }

      mimetype = info.mimeType;
      fileFound = true;

      file.on("data", (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
    });

    busboy.on("finish", async () => {
      if (!fileFound) {
        return reject(new Error("Nenhum arquivo enviado no campo 'file'"));
      }

      try {
        const texto = await extrairTextoDeBuffer(fileBuffer, mimetype);
        return resolve(texto);
      } catch (err) {
        console.error("Erro ao extrair texto:", err);
        reject(new Error("Falha ao extrair texto do arquivo."));
      }
    });

    req.pipe(busboy);
  });
