/* ============================================================
   IA – EXTRAÇÃO DE TEXTO DO ARQUIVO (PDF, DOCX, TXT)
   Suporta upload multipart via Busboy
   ============================================================ */

const Busboy = require("busboy");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

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
        if (mimetype.includes("pdf")) {
          const pdf = await pdfParse(fileBuffer);
          return resolve(pdf.text || "");
        }

        if (mimetype.includes("word") || mimetype.includes("docx")) {
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          return resolve(result.value || "");
        }

        // fallback: texto puro
        return resolve(fileBuffer.toString("utf8"));
      } catch (err) {
        console.error("Erro ao extrair texto:", err);
        reject(new Error("Falha ao extrair texto do arquivo."));
      }
    });

    req.pipe(busboy);
  });
