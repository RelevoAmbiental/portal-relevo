const Busboy = require("busboy");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

exports.extrairArquivo = (req) =>
  new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = Buffer.from([]);
    let mimetype = "";

    busboy.on("file", (fieldname, file, info) => {
      if (fieldname !== "arquivo") {
        reject(new Error("Campo de upload inválido."));
        return;
      }

      mimetype = info.mimeType;

      file.on("data", (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
    });

    busboy.on("finish", async () => {
      try {
        if (mimetype.includes("pdf")) {
          const pdf = await pdfParse(fileBuffer);
          resolve(pdf.text);
        } else if (mimetype.includes("word") || mimetype.includes("docx")) {
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          resolve(result.value);
        } else {
          resolve(fileBuffer.toString("utf8"));
        }
      } catch (err) {
        reject(err);
      }
    });

    req.pipe(busboy);
  });
