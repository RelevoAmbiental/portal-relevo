import { renderIntoApp } from "../ui/layout.js";
import { state, setUsers } from "../core/state.js";
import { listenUsers } from "../services/firestore-users.js";
import { ensureProjetosListener } from "./projetos.js";
import { parseTxtCronograma, salvarImportacaoLote } from "../services/importar-txt.js";

let unsubscribeUsers = null;

let textoImportacao = "";
let previewImportacao = [];
let errosImportacao = [];
let avisosImportacao = [];
let metaImportacao = {
  projetoNome: "",
  responsavelPadraoTexto: "",
  dataInicioBase: ""
};

let projetoSelecionadoId = "";
let responsavelSelecionadoUid = "";
let mensagemImportacao = "";
let mensagemTipo = "info";
let salvando = false;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProjetosAtivos() {
  return state.projetos.filter((item) => !item.arquivado);
}

function getUsersDisponiveis() {
  return state.users || [];
}

function getProjetoSelecionado() {
  return state.projetos.find((item) => item.id === projetoSelecionadoId) || null;
}

function getResponsavelSelecionado() {
  return state.users.find((item) => item.uid === responsavelSelecionadoUid || item.id === responsavelSelecionadoUid) || null;
}

function ensureDefaults() {
  const projetosAtivos = getProjetosAtivos();
  const users = getUsersDisponiveis();

  if (!projetoSelecionadoId && projetosAtivos.length === 1) {
    projetoSelecionadoId = projetosAtivos[0].id;
  }

  if (!responsavelSelecionadoUid && users.length === 1) {
    responsavelSelecionadoUid = users[0].uid;
  }

  if (!projetoSelecionadoId && metaImportacao.projetoNome) {
    const found = projetosAtivos.find(
      (item) => (item.nome || "").trim().toLowerCase() === metaImportacao.projetoNome.trim().toLowerCase()
    );
    if (found) {
      projetoSelecionadoId = found.id;
    }
  }

  if (!responsavelSelecionadoUid && metaImportacao.responsavelPadraoTexto) {
    const termo = metaImportacao.responsavelPadraoTexto.trim().toLowerCase();

    const found = users.find((item) => {
      const nome = (item.nome || "").trim().toLowerCase();
      const email = (item.email || "").trim().toLowerCase();
      const username = (item.username || "").trim().toLowerCase();
      return nome === termo || email === termo || username === termo;
    });

    if (found) {
      responsavelSelecionadoUid = found.uid;
    }
  }
}

function getExemploTxt() {
  return `[PROJETO] Exemplo de Projeto
[RESPONSAVEL_PADRAO] Samuel
[INICIO] 2026-04-01

[FASE] Campo
- Prospecção espeleológica | 5d | alta
- Caminhamento complementar | 2d | media | Revisar pontos de drenagem e acessos

[FASE] Gabinete
- Organização de dados | 3d
- Relatório técnico parcial | 6d | alta

[FASE] Entrega
- Revisão final | 2d
- Entrega ao cliente | 1d | alta`;
}

function renderMensagem() {
  if (!mensagemImportacao) return "";

  return `
    <div class="cronograma-import-message cronograma-import-message--${escapeHtml(mensagemTipo)}">
      ${escapeHtml(mensagemImportacao)}
    </div>
  `;
}

function renderErrosAvisos() {
  if (!errosImportacao.length && !avisosImportacao.length) return "";

  return `
    <div class="cronograma-import-feedback-grid">
      ${
        errosImportacao.length
          ? `<section class="cronograma-panel">
              <h3>Erros encontrados</h3>
              <div class="cronograma-import-list cronograma-import-list--error">
                ${errosImportacao.map((item) => `<div class="cronograma-import-list__item">${escapeHtml(item)}</div>`).join("")}
              </div>
            </section>`
          : ""
      }

      ${
        avisosImportacao.length
          ? `<section class="cronograma-panel">
              <h3>Avisos</h3>
              <div class="cronograma-import-list cronograma-import-list--warning">
                ${avisosImportacao.map((item) => `<div class="cronograma-import-list__item">${escapeHtml(item)}</div>`).join("")}
              </div>
            </section>`
          : ""
      }
    </div>
  `;
}

function renderPreview() {
  if (!previewImportacao.length) {
    return `
      <section class="cronograma-panel">
        <h3>Prévia da importação</h3>
        <div class="cronograma-empty-state">
          Valide um TXT para visualizar as tarefas antes de gravar.
        </div>
      </section>
    `;
  }

  return `
    <section class="cronograma-panel">
      <div class="cronograma-import-preview-head">
        <div>
          <h3>Prévia da importação</h3>
          <p>${previewImportacao.length} tarefa(s) pronta(s) para revisão.</p>
        </div>

        <div class="cronograma-tag-row cronograma-tag-row--tight">
          ${
            metaImportacao.projetoNome
              ? `<span class="cronograma-tag">Projeto no TXT: ${escapeHtml(metaImportacao.projetoNome)}</span>`
              : ""
          }
          ${
            metaImportacao.responsavelPadraoTexto
              ? `<span class="cronograma-tag">Responsável no TXT: ${escapeHtml(metaImportacao.responsavelPadraoTexto)}</span>`
              : ""
          }
          ${
            metaImportacao.dataInicioBase
              ? `<span class="cronograma-tag">Início base: ${escapeHtml(metaImportacao.dataInicioBase)}</span>`
              : ""
          }
        </div>
      </div>

      <div class="cronograma-import-table-wrap">
        <table class="cronograma-import-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tarefa</th>
              <th>Fase</th>
              <th>Duração</th>
              <th>Prioridade</th>
              <th>Vencimento</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            ${previewImportacao
              .map(
                (item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(item.titulo)}</td>
                    <td>${escapeHtml(item.faseLabel || item.fase)}</td>
                    <td>${item.duracaoDias ? `${item.duracaoDias}d` : "—"}</td>
                    <td>${escapeHtml(item.prioridade || "media")}</td>
                    <td>${escapeHtml(item.dataVencimento || "—")}</td>
                    <td>${escapeHtml(item.descricao || "—")}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function getTemplate() {
  ensureDefaults();

  const projetosAtivos = getProjetosAtivos();
  const users = getUsersDisponiveis();

  return `
    <div class="cronograma-import-layout">
      <section class="cronograma-placeholder-card">
        <div class="cronograma-import-head">
          <div>
            <h2>Importação por TXT estruturado</h2>
            <p>
              Nesta etapa, o TXT passa a irrigar o cronograma: você valida o texto, revisa a prévia e só depois grava as tarefas no Firestore.
            </p>
          </div>

          <div class="cronograma-checklist">
            <div class="cronograma-checklist__item">Sem gateway</div>
            <div class="cronograma-checklist__item">Sem Cloud Functions</div>
            <div class="cronograma-checklist__item">Sem OpenAI API</div>
            <div class="cronograma-checklist__item">Parser local no frontend</div>
          </div>
        </div>

        ${renderMensagem()}

        <div class="cronograma-import-stack">
          <div class="cronograma-import-actions">
            <label class="cronograma-btn cronograma-btn--secondary cronograma-btn--file">
              Selecionar TXT
              <input id="importTxtFile" type="file" accept=".txt,text/plain" hidden />
            </label>

            <button class="cronograma-btn cronograma-btn--ghost" type="button" id="btnImportExample">
              Carregar exemplo
            </button>

            <button class="cronograma-btn cronograma-btn--ghost" type="button" id="btnImportClear">
              Limpar
            </button>
          </div>

          <label class="cronograma-field">
            <span>Conteúdo TXT</span>
            <textarea
              id="importTxtInput"
              class="cronograma-import-textarea"
              placeholder="[FASE] Campo&#10;- Prospecção espeleológica | 5d&#10;&#10;[FASE] Gabinete&#10;- Relatório técnico | 6d"
            >${escapeHtml(textoImportacao)}</textarea>
          </label>

          <div class="cronograma-import-config-grid">
            <label class="cronograma-field">
              <span>Projeto de destino</span>
              <select id="importProjetoSelect" class="cronograma-input">
                <option value="">Selecione...</option>
                ${projetosAtivos
                  .map(
                    (item) => `
                      <option value="${escapeHtml(item.id)}" ${item.id === projetoSelecionadoId ? "selected" : ""}>
                        ${escapeHtml(item.nome)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>

            <label class="cronograma-field">
              <span>Responsável padrão</span>
              <select id="importResponsavelSelect" class="cronograma-input">
                <option value="">Selecione...</option>
                ${users
                  .map(
                    (item) => `
                      <option value="${escapeHtml(item.uid)}" ${item.uid === responsavelSelecionadoUid ? "selected" : ""}>
                        ${escapeHtml(item.nome)}${item.email ? ` — ${escapeHtml(item.email)}` : ""}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>
          </div>

          <div class="cronograma-import-actions">
            <button class="cronograma-btn" type="button" id="btnValidarImportacao">
              Validar TXT
            </button>

            <button
              class="cronograma-btn cronograma-btn--secondary"
              type="button"
              id="btnSalvarImportacao"
              ${previewImportacao.length && !errosImportacao.length && !salvando ? "" : "disabled"}
            >
              ${salvando ? "Salvando..." : "Salvar no Firestore"}
            </button>
          </div>
        </div>
      </section>

      <aside class="cronograma-panel">
        <h3>Formato aceito nesta fase</h3>

        <div class="cronograma-mini-list">
          <div class="cronograma-mini-list__item">
            <strong>[FASE] Campo</strong>
            <span>- Prospecção espeleológica | 5d | alta</span>
          </div>
          <div class="cronograma-mini-list__item">
            <strong>[FASE] Gabinete</strong>
            <span>- Relatório técnico | 6d | media | Consolidar dados</span>
          </div>
          <div class="cronograma-mini-list__item">
            <strong>Metadados opcionais</strong>
            <span>[PROJETO], [RESPONSAVEL_PADRAO], [INICIO]</span>
          </div>
        </div>

        <p style="margin-top:16px;">
          Nesta rodada, o foco é robustez: ler bem, revisar bem e gravar limpo. Primeiro a água chega; depois a gente faz a irrigação por gotejamento.
        </p>
      </aside>

      ${renderErrosAvisos()}
      ${renderPreview()}
    </div>
  `;
}

function validarImportacao() {
  const parsed = parseTxtCronograma(textoImportacao);

  metaImportacao = parsed.meta;
  previewImportacao = parsed.itens;
  errosImportacao = parsed.erros;
  avisosImportacao = parsed.avisos;

  if (!parsed.erros.length && parsed.itens.length) {
    mensagemImportacao = `${parsed.itens.length} tarefa(s) validada(s) com sucesso.`;
    mensagemTipo = "success";
  } else if (parsed.erros.length) {
    mensagemImportacao = "O TXT foi lido, mas há pendências a corrigir antes de salvar.";
    mensagemTipo = "warning";
  } else {
    mensagemImportacao = "Nenhuma tarefa válida foi encontrada.";
    mensagemTipo = "warning";
  }

  renderImportarView();
}

function limparImportacao() {
  textoImportacao = "";
  previewImportacao = [];
  errosImportacao = [];
  avisosImportacao = [];
  metaImportacao = {
    projetoNome: "",
    responsavelPadraoTexto: "",
    dataInicioBase: ""
  };
  mensagemImportacao = "";
  mensagemTipo = "info";
  renderImportarView();
}

async function salvarImportacao() {
  try {
    if (!previewImportacao.length) {
      throw new Error("Valide um TXT antes de salvar.");
    }

    if (errosImportacao.length) {
      throw new Error("Corrija os erros da validação antes de salvar.");
    }

    const projeto = getProjetoSelecionado();
    const responsavel = getResponsavelSelecionado();

    if (!projeto?.id) {
      throw new Error("Selecione o projeto de destino.");
    }

    if (!responsavel?.uid) {
      throw new Error("Selecione o responsável padrão.");
    }

    salvando = true;
    mensagemImportacao = "";
    renderImportarView();

    const resultado = await salvarImportacaoLote({
      itens: previewImportacao,
      projeto,
      responsavel
    });

    mensagemImportacao = `${resultado.quantidade} tarefa(s) importada(s) com sucesso no Firestore.`;
    mensagemTipo = "success";

    previewImportacao = [];
    errosImportacao = [];
    avisosImportacao = [];
    textoImportacao = "";

    renderImportarView();
  } catch (error) {
    console.error(error);
    mensagemImportacao = error?.message || "Não foi possível salvar a importação.";
    mensagemTipo = "error";
    renderImportarView();
  } finally {
    salvando = false;
  }
}

function ensureUsersListener() {
  if (unsubscribeUsers) return;

  unsubscribeUsers = listenUsers(
    (items) => {
      setUsers(items);

      if (state.currentView === "importar") {
        renderImportarView();
      }
    },
    (error) => {
      console.error(error);
      mensagemImportacao = "Não foi possível carregar a coleção users.";
      mensagemTipo = "error";

      if (state.currentView === "importar") {
        renderImportarView();
      }
    }
  );
}

function mountEvents() {
  const txtInput = document.getElementById("importTxtInput");
  const fileInput = document.getElementById("importTxtFile");
  const projetoSelect = document.getElementById("importProjetoSelect");
  const responsavelSelect = document.getElementById("importResponsavelSelect");
  const btnExample = document.getElementById("btnImportExample");
  const btnClear = document.getElementById("btnImportClear");
  const btnValidar = document.getElementById("btnValidarImportacao");
  const btnSalvar = document.getElementById("btnSalvarImportacao");

  if (txtInput) {
    txtInput.addEventListener("input", (event) => {
      textoImportacao = event.target.value || "";
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        textoImportacao = await file.text();
        mensagemImportacao = `Arquivo "${file.name}" carregado para validação.`;
        mensagemTipo = "info";
        renderImportarView();
      } catch (error) {
        console.error(error);
        mensagemImportacao = "Não foi possível ler o arquivo TXT.";
        mensagemTipo = "error";
        renderImportarView();
      }
    });
  }

  if (projetoSelect) {
    projetoSelect.addEventListener("change", (event) => {
      projetoSelecionadoId = event.target.value || "";
    });
  }

  if (responsavelSelect) {
    responsavelSelect.addEventListener("change", (event) => {
      responsavelSelecionadoUid = event.target.value || "";
    });
  }

  if (btnExample) {
    btnExample.addEventListener("click", () => {
      textoImportacao = getExemploTxt();
      mensagemImportacao = "Exemplo carregado no editor.";
      mensagemTipo = "info";
      renderImportarView();
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", limparImportacao);
  }

  if (btnValidar) {
    btnValidar.addEventListener("click", validarImportacao);
  }

  if (btnSalvar) {
    btnSalvar.addEventListener("click", salvarImportacao);
  }
}

export function renderImportarView() {
  ensureProjetosListener();
  ensureUsersListener();
  renderIntoApp(getTemplate());
  mountEvents();
}
