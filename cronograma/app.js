/* ============================================================
   CONFIG — URLs reais das Cloud Functions
   ============================================================ */
const URL_EXTRair_TEXTO =
    "https://extrairtexto-zeq2hfaiea-uc.a.run.app";

const URL_INTERPRETAR =
    "https://processarproposta-zeq2hfaiea-uc.a.run.app";

const URL_CRONOGRAMA =
    "https://gerarcronograma-zeq2hfaiea-uc.a.run.app";


/* ============================================================
   1. EXTRair TEXTO (PDF/DOCX)
   ============================================================ */
async function extrairTexto() {
    try {
        const fileInput = document.getElementById("arquivoInput");
        const file = fileInput.files[0];

        if (!file) {
            alert("Selecione um arquivo PDF ou DOCX antes de continuar.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(URL_EXTRair_TEXTO, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Erro ao extrair texto do arquivo.");
        }

        const result = await response.json();
        document.getElementById("textoExtraido").value = result.texto;

    } catch (err) {
        console.error("Erro na extração:", err);
        alert("Falha ao extrair o conteúdo. Verifique o arquivo e tente novamente.");
    }
}


/* ============================================================
   2. INTERPRETAR PROPOSTA
   ============================================================ */
async function interpretarProposta() {
    try {
        const texto = document.getElementById("textoExtraido").value.trim();

        if (!texto) {
            alert("Você precisa extrair o texto primeiro.");
            return;
        }

        const response = await fetch(URL_INTERPRETAR, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto })
        });

        if (!response.ok) {
            throw new Error("Erro ao interpretar proposta.");
        }

        const result = await response.json();

        document.getElementById("estruturaProposta").value =
            JSON.stringify(result, null, 2);

    } catch (err) {
        console.error("Erro interpretar:", err);
        alert("Falha ao interpretar proposta.");
    }
}


/* ============================================================
   3. GERAR CRONOGRAMA
   ============================================================ */
async function gerarCronograma() {
    try {
        const estruturaJson = document
            .getElementById("estruturaProposta")
            .value.trim();

        if (!estruturaJson) {
            alert("Você precisa interpretar a proposta antes.");
            return;
        }

        let estrutura;
        try {
            estrutura = JSON.parse(estruturaJson);
        } catch (e) {
            alert("JSON inválido na estrutura de proposta!");
            return;
        }

        const response = await fetch(URL_CRONOGRAMA, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estrutura })
        });

        if (!response.ok) {
            throw new Error("Erro ao gerar cronograma.");
        }

        const result = await response.json();

        document.getElementById("cronogramaFinal").value =
            JSON.stringify(result, null, 2);

    } catch (err) {
        console.error("Erro gerar cronograma:", err);
        alert("Falha ao gerar cronograma.");
    }
}
