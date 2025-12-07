const Busboy = require("busboy");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

exports.extrairArquivo = (req) =>
  new Promise((resolve, reject) => {
    try {
      const busboy = Busboy({ headers: req.headers });
      let arquivo;

      busboy.on("file", (_, file, info) => {
        const { mimeType } = info;
        const chunks = [];

        file.on("data", (data) => chunks.push(data));

        file.on("end", async () => {
          const buffer = Buffer.concat(chunks);

          try {
            if (mimeType.includes("pdf")) {
              const parsed = await pdf(buffer);
              resolve(parsed.text);
            } else if (
              mimeType.includes("docx") ||
              mimeType.includes("doc")
            ) {
              const parsed = await mammoth.extractRawText({ buffer });
              resolve(parsed.value);
            } else {
              resolve(buffer.toString("utf8"));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      busboy.on("finish", () => {
        if (!arquivo) resolve("");
      });

      req.pipe(busboy);
    } catch (err) {
      reject(err);
    }
  });
