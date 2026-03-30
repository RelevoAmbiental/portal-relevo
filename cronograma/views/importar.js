import { renderIntoApp } from "../ui/layout.js";
import { state, setUsers } from "../core/state.js";
import { listenUsers } from "../services/firestore-users.js";
import { ensureProjetosListener } from "./projetos.js";
import {
  parseTxtCronograma,
  resolveResponsavelByTexto,
  salvarImportacaoLote
} from "../services/importar-txt.js";

let unsubscribeUsers = null;

let textoImportacao = "";
let previewImportacao = [];
let errosImportacao = [];
let avisosImportacao = [];
let errosBaseImportacao = [];
let avisosBaseImportacao = [];
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
let faseLoteSelecionada = "";

const FASE_OPTIONS = [
  { value: "planejamento", label: "Planejamento" },
  { value: "campo", label: "Campo" },
  { value: "gabinete", label: "Gabinete" },
  { value: "entrega", label: "Entrega" },
  { value: "administrativo", label: "Administrativo" }
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" }
];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugifyFase(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function getFaseLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  const found = FASE_OPTIONS.find((item) => item.value === key);
  if (found) return found.label;
  if (!key) return "Planejamento";
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function getUserByUid(uid) {
  return state.users.find((item) => item.uid === uid || item.id === uid) || null;
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
    const found = resolveResponsavelByTexto(metaImportacao.responsavelPadraoTexto, users);
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
- Prospecção espeleológica | 5d | alta | resp:Samuel
- Caminhamento complementar | 2d | media | Revisar pontos de drenagem e acessos

[FASE] Gabinete
- Organização de dados | 3d | resp:joao@relevo.eco.br
- Relatório técnico parcial | 6d | alta

[FASE] Entrega
- Revisão final | 2d
- Entrega ao cliente | 1d | alta`;
}

function getPromptGeracaoTxt() {
  return `Converta o escopo, cronograma ou orçamento abaixo em um TXT estruturado para importação de tarefas no Portal Relevo.

Regras obrigatórias:
1. Responda SOMENTE com o TXT final.
2. Não escreva explicações antes ou depois.
3. Use exatamente a estrutura abaixo.
4. Organize as tarefas por fase.
5. Cada tarefa deve ficar em uma linha iniciada por "-".
6. Após o título, informe a duração estimada no formato "Xd".
7. Quando fizer sentido, informe a prioridade: baixa, media ou alta.
8. Metadados opcionais aceitos no topo:
   [PROJETO] Nome do projeto
   [RESPONSAVEL_PADRAO] Nome ou e-mail
   [INICIO] AAAA-MM-DD
9. Estrutura de fases preferenciais:
   Planejamento
   Campo
   Gabinete
   Entrega
   Administrativo
10. Considere a emissão da nota fiscal como uma atividade que acontece 10 dias depois da entrega do produto final e que o faturamento desta nota aconteça 30 dias depois da emissão da nota.
11. Não use tabelas, markdown, bullets diferentes ou numeração.

Modelo:
[PROJETO] Nome do Projeto
[RESPONSAVEL_PADRAO] Nome do Responsável
[INICIO] 2026-04-01

[FASE] Planejamento
- Alinhamento inicial | 1d | media
- Organização logística | 4d | media

[FASE] Campo
- Prospecção espeleológica | 10d | alta
- Caminhamento complementar | 2d | media

[FASE] Gabinete
- Organização de dados | 3d | media
- Relatório técnico parcial | 10d | alta

[FASE] Entrega
- Revisão final | 2d | alta
- Entrega ao cliente | 1d | alta

[FASE] Adminstrativo
- Emissão de Nota fiscal | 1d | alta
- Faturamento da Nota fiscal | 30d | alta

Agora converta o conteúdo que eu enviar para esse formato exato.`;
}

function baixarPromptGeracaoTxt() {
  const conteudo = getPromptGeracaoTxt();
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "prompt-geracao-txt-cronograma-relevo.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function addDaysIso(isoDate, daysToAdd) {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(daysToAdd || 0));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return "";
}

function normalizeDuracao(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number);
}

function getFaseOptionsDinamicas() {
  const dynamic = previewImportacao
    .map((item) => ({
      value: String(item.fase || "").trim().toLowerCase(),
      label: item.faseLabel || getFaseLabel(item.fase)
    }))
    .filter((item) => item.value);

  const map = new Map();
  [...FASE_OPTIONS, ...dynamic].forEach((item) => {
    if (!map.has(item.value)) {
      map.set(item.value, item);
    }
  });

  return Array.from(map.values());
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

function renderResponsavelOptions(selectedUid) {
  const users = getUsersDisponiveis();

  return `
    <option value="">Selecione...</option>
    ${users
      .map(
        (item) => `
          <option value="${escapeHtml(item.uid)}" ${item.uid === selectedUid ? "selected" : ""}>
            ${escapeHtml(item.nome)}${item.email ? ` — ${escapeHtml(item.email)}` : ""}
          </option>
        `
      )
      .join("")}
  `;
}

function renderFaseOptions(selectedValue) {
  return getFaseOptionsDinamicas()
    .map(
      (item) => `
        <option value="${escapeHtml(item.value)}" ${item.value === selectedValue ? "selected" : ""}>
          ${escapeHtml(item.label)}
        </option>
      `
    )
    .join("");
}

function renderPrioridadeOptions(selectedValue) {
  return PRIORIDADE_OPTIONS
    .map(
      (item) => `
        <option value="${escapeHtml(item.value)}" ${item.value === selectedValue ? "selected" : ""}>
          ${escapeHtml(item.label)}
        </option>
      `
    )
    .join("");
}
function renderPreview() {
  if (!previewImportacao.length) {
    return `
      <section class="cronograma-panel cronograma-import-preview-section">
        <h3>Prévia da importação</h3>
        <div class="cronograma-empty-state">
          Valide um TXT para visualizar as tarefas antes de gravar.
        </div>
      </section>
    `;
  }

  const totalComResponsavelLinha = previewImportacao.filter((item) => item.responsavelOrigem === "linha").length;
  const totalComCascata = previewImportacao.filter((item) => item.dataInicio || item.dataVencimento).length;

  return `
    <section class="cronograma-panel cronograma-import-preview-section">
      <div class="cronograma-import-preview-head">
        <div>
          <h3>Prévia da importação</h3>
          <p>${previewImportacao.length} tarefa(s) pronta(s) para revisão.</p>
        </div>

        <div class="cronograma-tag-row cronograma-tag-row--tight">
          <span class="cronograma-tag">Overrides por linha: ${totalComResponsavelLinha}</span>
          <span class="cronograma-tag">Com datas: ${totalComCascata}</span>
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

      <div class="cronograma-import-bulk-actions">
        <div class="cronograma-import-actions">
          <button class="cronograma-btn cronograma-btn--ghost" type="button" id="btnRecalcularDatasImportacao">
            Recalcular datas em cascata
          </button>

          <button class="cronograma-btn cronograma-btn--ghost" type="button" id="btnAplicarResponsavelPadrao">
            Aplicar responsável padrão a todas
          </button>
        </div>

        <div class="cronograma-import-config-grid">
          <label class="cronograma-field">
            <span>Fase em lote</span>
            <select id="importFaseLoteSelect" class="cronograma-input">
              <option value="">Selecione...</option>
              ${renderFaseOptions(faseLoteSelecionada)}
            </select>
          </label>

          <div class="cronograma-field" style="justify-content:end;">
            <span>&nbsp;</span>
            <button class="cronograma-btn cronograma-btn--ghost" type="button" id="btnAplicarFaseLote">
              Aplicar fase a todas
            </button>
          </div>
        </div>
      </div>

      <div class="cronograma-import-table-wrap">
        <table class="cronograma-import-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tarefa</th>
              <th>Fase</th>
              <th>Responsável</th>
              <th>Início</th>
              <th>Duração</th>
              <th>Vencimento</th>
              <th>Prioridade</th>
              <th>Descrição</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${previewImportacao
              .map(
                (item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>
                      <input
                        class="cronograma-input"
                        type="text"
                        value="${escapeHtml(item.titulo || "")}"
                        data-preview-index="${index}"
                        data-preview-field="titulo"
                      />
                    </td>
                    <td>
                      <select
                        class="cronograma-input"
                        data-preview-index="${index}"
                        data-preview-field="fase"
                      >
                        ${renderFaseOptions(item.fase)}
                      </select>
                    </td>
                    <td>
                      <div class="cronograma-import-cell-stack">
                        <select
                          class="cronograma-input"
                          data-preview-index="${index}"
                          data-preview-field="responsavelUid"
                        >
                          ${renderResponsavelOptions(item.responsavelUid || "")}
                        </select>
                        ${
                          item.responsavelOrigem === "linha"
                            ? `<span class="cronograma-import-cell-muted">definido na linha</span>`
                            : item.responsavelOrigem === "padrao"
                            ? `<span class="cronograma-import-cell-muted">responsável padrão</span>`
                            : item.responsavelTexto
                            ? `<span class="cronograma-import-cell-muted">não encontrado: ${escapeHtml(item.responsavelTexto)}</span>`
                            : `<span class="cronograma-import-cell-muted">—</span>`
                        }
                      </div>
                    </td>
                    <td>
                      <input
                        class="cronograma-input"
                        type="date"
                        value="${escapeHtml(item.dataInicio || "")}"
                        data-preview-index="${index}"
                        data-preview-field="dataInicio"
                      />
                    </td>
                    <td>
                      <input
                        class="cronograma-input"
                        type="number"
                        min="1"
                        value="${item.duracaoDias || ""}"
                        data-preview-index="${index}"
                        data-preview-field="duracaoDias"
                      />
                    </td>
                    <td>
                      <input
                        class="cronograma-input"
                        type="date"
                        value="${escapeHtml(item.dataVencimento || "")}"
                        data-preview-index="${index}"
                        data-preview-field="dataVencimento"
                      />
                    </td>
                    <td>
                      <select
                        class="cronograma-input"
                        data-preview-index="${index}"
                        data-preview-field="prioridade"
                      >
                        ${renderPrioridadeOptions(item.prioridade || "media")}
                      </select>
                    </td>
                    <td>
                      <textarea
                        class="cronograma-import-inline-textarea"
                        rows="2"
                        data-preview-index="${index}"
                        data-preview-field="descricao"
                      >${escapeHtml(item.descricao || "")}</textarea>
                    </td>
                    <td>
                      <button
                        class="cronograma-btn cronograma-btn--ghost"
                        type="button"
                        data-remove-preview-index="${index}"
                      >
                        Remover
                      </button>
                    </td>
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

function buildResumoPorFase() {
  if (!previewImportacao.length) return [];

  const grupos = new Map();

  previewImportacao.forEach((item) => {
    const chave = item.faseLabel || item.fase || "Outros";

    if (!grupos.has(chave)) {
      grupos.set(chave, []);
    }

    grupos.get(chave).push(item);
  });

  return Array.from(grupos.entries()).map(([fase, itens]) => ({
    fase,
    quantidade: itens.length,
    titulos: itens.map((item) => item.titulo).filter(Boolean)
  }));
}

function renderResumoImportacao() {
  const resumo = buildResumoPorFase();

  return `
    <aside class="cronograma-panel">
      <div class="cronograma-import-summary-head">
        <div>
          <h3>Resumo do TXT</h3>
          <p>
            ${
              previewImportacao.length
                ? "Síntese das tarefas identificadas antes do salvamento."
                : "Valide o TXT para visualizar o resumo por fase."
            }
          </p>
        </div>

        <button
          class="cronograma-btn cronograma-btn--ghost"
          type="button"
          id="btnBaixarPromptTxt"
        >
          Baixar prompt TXT
        </button>
      </div>

      ${
        resumo.length
          ? `
            <div class="cronograma-mini-list">
              ${resumo
                .map(
                  (grupo) => `
                    <div class="cronograma-mini-list__item">
                      <strong>${grupo.quantidade} tarefa(s) de ${escapeHtml(grupo.fase)}</strong>
                      <span>${escapeHtml(grupo.titulos.join(", "))}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
          : `
            <div class="cronograma-empty-state">
              Nenhuma tarefa resumida ainda.
            </div>
          `
      }
    </aside>
  `;
}

function getTemplate() {
  ensureDefaults();

  const projetosAtivos = getProjetosAtivos();
  const users = getUsersDisponiveis();

  return `
    <div class="cronograma-import-layout">
      <section class="cronograma-placeholder-card">
        ${renderMensagem()}

        <div class="cronograma-import-stack">
          <div class="cronograma-import-header-clean">
            <div>
              <h2>Importar tarefas por TXT</h2>
              <p>
                Cole o conteúdo, valide a prévia, ajuste os itens se necessário e grave as tarefas no cronograma.
              </p>
            </div>
          </div>

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
              placeholder="[PROJETO] Exemplo de Projeto&#10;[RESPONSAVEL_PADRAO] Samuel&#10;[INICIO] 2026-04-01&#10;&#10;[FASE] Campo&#10;- Prospecção espeleológica | 5d | alta | resp:Samuel&#10;&#10;[FASE] Gabinete&#10;- Relatório técnico parcial | 6d | alta"
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
            <button class="cronograma-btn cronograma-btn--primary" type="button" id="btnValidarImportacao">
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

      ${renderResumoImportacao()}
      ${renderErrosAvisos()}
      ${renderPreview()}
    </div>
  `;
}
function enrichItemResponsavel(item, uid, origem = "manual") {
  const user = uid ? getUserByUid(uid) : null;

  if (user) {
    item.responsavel = user.nome || "";
    item.responsavelUid = user.uid || "";
    item.responsavelEmail = user.email || "";
    item.responsavelOrigem = origem;
    item.responsavelTexto = "";
    return;
  }

  item.responsavel = "";
  item.responsavelUid = "";
  item.responsavelEmail = "";
  item.responsavelOrigem = "";
}

function normalizePreviewItem(item) {
  const normalized = { ...item };

  normalized.titulo = String(normalized.titulo || "").trim();
  normalized.fase = slugifyFase(normalized.fase || "planejamento") || "planejamento";
  normalized.faseLabel = getFaseLabel(normalized.fase);
  normalized.prioridade = PRIORIDADE_OPTIONS.some((option) => option.value === normalized.prioridade)
    ? normalized.prioridade
    : "media";
  normalized.duracaoDias = normalizeDuracao(normalized.duracaoDias);
  normalized.dataInicio = normalizeDate(normalized.dataInicio);
  normalized.dataVencimento = normalizeDate(normalized.dataVencimento);
  normalized.descricao = String(normalized.descricao || "").trim();

  return normalized;
}

function recomputePreviewFeedback() {
  const erros = [...errosBaseImportacao];
  const avisos = [...avisosBaseImportacao];
  const responsavelPadrao = getResponsavelSelecionado();

  previewImportacao = previewImportacao.map((item) => normalizePreviewItem(item));

  previewImportacao.forEach((item, index) => {
    if (!item.titulo) {
      erros.push(`Linha ${index + 1}: a tarefa está sem título.`);
    }

    if (item.dataInicio && item.dataVencimento && item.dataInicio > item.dataVencimento) {
      erros.push(`Linha ${index + 1}: a data de início está depois do vencimento.`);
    }

    if (item.responsavelTexto && !item.responsavelUid) {
      erros.push(`Linha ${index + 1}: responsável "${item.responsavelTexto}" ainda não foi resolvido.`);
    } else if (!item.responsavelUid && !responsavelPadrao?.uid) {
      avisos.push(`Linha ${index + 1}: sem responsável definido; selecione um responsável padrão ou ajuste a linha.`);
    }
  });

  errosImportacao = erros;
  avisosImportacao = avisos;
}

function enriquecerPreview(parsed) {
  const users = getUsersDisponiveis();
  const responsavelPadrao = getResponsavelSelecionado();

  const itens = parsed.itens.map((item) => {
    const enriched = normalizePreviewItem(item);

    if (item.responsavelTexto) {
      const found = resolveResponsavelByTexto(item.responsavelTexto, users);

      if (found) {
        enriched.responsavel = found.nome || "";
        enriched.responsavelUid = found.uid || "";
        enriched.responsavelEmail = found.email || "";
        enriched.responsavelOrigem = "linha";
        enriched.responsavelTexto = "";
      } else {
        enriched.responsavel = "";
        enriched.responsavelUid = "";
        enriched.responsavelEmail = "";
        enriched.responsavelOrigem = "";
      }
    } else if (responsavelPadrao?.uid) {
      enriched.responsavel = responsavelPadrao.nome || "";
      enriched.responsavelUid = responsavelPadrao.uid || "";
      enriched.responsavelEmail = responsavelPadrao.email || "";
      enriched.responsavelOrigem = "padrao";
      enriched.responsavelTexto = "";
    } else if (metaImportacao.responsavelPadraoTexto) {
      const foundMeta = resolveResponsavelByTexto(metaImportacao.responsavelPadraoTexto, users);

      if (foundMeta) {
        enriched.responsavel = foundMeta.nome || "";
        enriched.responsavelUid = foundMeta.uid || "";
        enriched.responsavelEmail = foundMeta.email || "";
        enriched.responsavelOrigem = "padrao";
        enriched.responsavelTexto = "";
      }
    }

    return enriched;
  });

  return { itens };
}

function validarImportacao() {
  const parsed = parseTxtCronograma(textoImportacao);

  metaImportacao = parsed.meta;
  ensureDefaults();

  const enriched = enriquecerPreview(parsed);

  previewImportacao = enriched.itens;
  errosBaseImportacao = [...parsed.erros];
  avisosBaseImportacao = [...parsed.avisos];

  recomputePreviewFeedback();

  if (!errosImportacao.length && previewImportacao.length) {
    mensagemImportacao = `${previewImportacao.length} tarefa(s) validada(s) com sucesso.`;
    mensagemTipo = "success";
  } else if (errosImportacao.length) {
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
  errosBaseImportacao = [];
  avisosBaseImportacao = [];
  metaImportacao = {
    projetoNome: "",
    responsavelPadraoTexto: "",
    dataInicioBase: ""
  };
  mensagemImportacao = "";
  mensagemTipo = "info";
  faseLoteSelecionada = "";
  renderImportarView();
}

function updatePreviewField(index, field, rawValue) {
  const item = previewImportacao[index];
  if (!item) return;

  if (field === "titulo") {
    item.titulo = String(rawValue || "").trim();
  }

  if (field === "fase") {
    item.fase = slugifyFase(rawValue || "planejamento") || "planejamento";
    item.faseLabel = getFaseLabel(item.fase);
  }

  if (field === "prioridade") {
    item.prioridade = String(rawValue || "media").trim().toLowerCase() || "media";
  }

  if (field === "duracaoDias") {
    item.duracaoDias = normalizeDuracao(rawValue);
  }

  if (field === "dataInicio") {
    item.dataInicio = normalizeDate(rawValue);
  }

  if (field === "dataVencimento") {
    item.dataVencimento = normalizeDate(rawValue);
  }

  if (field === "descricao") {
    item.descricao = String(rawValue || "").trim();
  }

  if (field === "responsavelUid") {
    enrichItemResponsavel(item, rawValue, "manual");
  }

  previewImportacao[index] = normalizePreviewItem(item);
  recomputePreviewFeedback();
}

function removerPreviewItem(index) {
  previewImportacao.splice(index, 1);
  recomputePreviewFeedback();

  if (!previewImportacao.length) {
    mensagemImportacao = "Todas as tarefas foram removidas da prévia.";
    mensagemTipo = "info";
  }
}

function recalcularDatasEmCascata() {
  if (!previewImportacao.length) return;

  const base =
    metaImportacao.dataInicioBase ||
    previewImportacao.find((item) => item.dataInicio)?.dataInicio ||
    "";

  if (!base) {
    mensagemImportacao = "Defina [INICIO] no TXT ou preencha a data inicial da primeira tarefa para recalcular.";
    mensagemTipo = "warning";
    renderImportarView();
    return;
  }

  let cursor = base;

  previewImportacao = previewImportacao.map((item) => {
    const clone = { ...item };

    clone.dataInicio = cursor;

    if (clone.duracaoDias) {
      clone.dataVencimento = addDaysIso(cursor, clone.duracaoDias - 1);
      cursor = addDaysIso(cursor, clone.duracaoDias);
    } else if (clone.dataVencimento) {
      cursor = addDaysIso(clone.dataVencimento, 1);
    } else {
      clone.dataVencimento = "";
      cursor = addDaysIso(cursor, 1);
    }

    return normalizePreviewItem(clone);
  });

  mensagemImportacao = "Datas recalculadas em cascata com sucesso.";
  mensagemTipo = "success";
  recomputePreviewFeedback();
  renderImportarView();
}

function aplicarResponsavelPadraoEmTodas() {
  const responsavel = getResponsavelSelecionado();

  if (!responsavel?.uid) {
    mensagemImportacao = "Selecione um responsável padrão antes de aplicar em lote.";
    mensagemTipo = "warning";
    renderImportarView();
    return;
  }

  previewImportacao = previewImportacao.map((item) => {
    const clone = { ...item };
    enrichItemResponsavel(clone, responsavel.uid, "padrao");
    return normalizePreviewItem(clone);
  });

  mensagemImportacao = "Responsável padrão aplicado a todas as tarefas da prévia.";
  mensagemTipo = "success";
  recomputePreviewFeedback();
  renderImportarView();
}

function aplicarFaseEmTodas() {
  if (!faseLoteSelecionada) {
    mensagemImportacao = "Selecione uma fase antes de aplicar em lote.";
    mensagemTipo = "warning";
    renderImportarView();
    return;
  }

  previewImportacao = previewImportacao.map((item) =>
    normalizePreviewItem({
      ...item,
      fase: faseLoteSelecionada,
      faseLabel: getFaseLabel(faseLoteSelecionada)
    })
  );

  mensagemImportacao = `Fase "${getFaseLabel(faseLoteSelecionada)}" aplicada a toda a prévia.`;
  mensagemTipo = "success";
  recomputePreviewFeedback();
  renderImportarView();
}
async function salvarImportacao() {
  try {
    if (!previewImportacao.length) {
      throw new Error("Valide um TXT antes de salvar.");
    }

    recomputePreviewFeedback();

    if (errosImportacao.length) {
      throw new Error("Corrija os erros da validação antes de salvar.");
    }

    const projeto = getProjetoSelecionado();
    const responsavel = getResponsavelSelecionado();

    if (!projeto?.id) {
      throw new Error("Selecione o projeto de destino.");
    }

    if (!responsavel?.uid) {
      const existeItemSemResponsavel = previewImportacao.some((item) => !item.responsavelUid);
      if (existeItemSemResponsavel) {
        throw new Error("Selecione o responsável padrão ou defina responsável por linha para todas as tarefas.");
      }
    }

    salvando = true;
    mensagemImportacao = "";
    renderImportarView();

    const resultado = await salvarImportacaoLote({
      itens: previewImportacao.map((item) => normalizePreviewItem(item)),
      projeto,
      responsavel
    });

    mensagemImportacao = `${resultado.quantidade} tarefa(s) importada(s) com sucesso no Firestore.`;
    mensagemTipo = "success";

    previewImportacao = [];
    errosImportacao = [];
    avisosImportacao = [];
    errosBaseImportacao = [];
    avisosBaseImportacao = [];
    textoImportacao = "";
    faseLoteSelecionada = "";

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
        recomputePreviewFeedback();
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
  const btnBaixarPromptTxt = document.getElementById("btnBaixarPromptTxt");
  const btnRecalcularDatas = document.getElementById("btnRecalcularDatasImportacao");
  const btnAplicarResponsavelPadrao = document.getElementById("btnAplicarResponsavelPadrao");
  const btnAplicarFaseLote = document.getElementById("btnAplicarFaseLote");
  const faseLoteSelect = document.getElementById("importFaseLoteSelect");

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
      recomputePreviewFeedback();
    });
  }

  if (responsavelSelect) {
    responsavelSelect.addEventListener("change", (event) => {
      responsavelSelecionadoUid = event.target.value || "";
      recomputePreviewFeedback();
    });
  }

  if (faseLoteSelect) {
    faseLoteSelect.addEventListener("change", (event) => {
      faseLoteSelecionada = event.target.value || "";
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

  if (btnBaixarPromptTxt) {
    btnBaixarPromptTxt.addEventListener("click", baixarPromptGeracaoTxt);
  }

  if (btnRecalcularDatas) {
    btnRecalcularDatas.addEventListener("click", recalcularDatasEmCascata);
  }

  if (btnAplicarResponsavelPadrao) {
    btnAplicarResponsavelPadrao.addEventListener("click", aplicarResponsavelPadraoEmTodas);
  }

  if (btnAplicarFaseLote) {
    btnAplicarFaseLote.addEventListener("click", aplicarFaseEmTodas);
  }

  document.querySelectorAll("[data-preview-field]").forEach((element) => {
    element.addEventListener("change", (event) => {
      const index = Number(event.target.dataset.previewIndex);
      const field = event.target.dataset.previewField;
      updatePreviewField(index, field, event.target.value);
      renderImportarView();
    });
  });

  document.querySelectorAll("[data-remove-preview-index]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const index = Number(event.currentTarget.dataset.removePreviewIndex);
      removerPreviewItem(index);
      renderImportarView();
    });
  });
}

export function renderImportarView() {
  ensureProjetosListener();
  ensureUsersListener();
  renderIntoApp(getTemplate());
  mountEvents();
}
