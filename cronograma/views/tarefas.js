import { renderIntoApp } from "../ui/layout.js";
import {
  state,
  setTarefas,
  setTarefaEditandoId,
  setMostrarTarefasArquivadas,
  setFiltroProjetoTarefa,
  setFiltroStatusTarefa,
  setFiltroResponsavelTarefa,
  setFiltroFaseTarefa,
  setUsers
} from "../core/state.js";
import {
  listenTarefas,
  criarTarefa,
  atualizarTarefa,
  arquivarTarefa,
  desarquivarTarefa,
  alternarSubtarefa
} from "../services/firestore-tarefas.js";
import { listenUsers } from "../services/firestore-users.js";
import { ensureProjetosListener } from "./projetos.js";

let unsubscribeTarefas = null;
let unsubscribeUsers = null;
let draftSubtarefas = [];

const STATUS_OPTIONS = [
  { value: "a_fazer", label: "A fazer" },
  { value: "andamento", label: "Em andamento" },
  { value: "acompanhando", label: "Acompanhando" },
  { value: "concluida", label: "Concluída" }
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" }
];

const FASE_OPTIONS = [
  { value: "planejamento", label: "Planejamento" },
  { value: "campo", label: "Campo" },
  { value: "gabinete", label: "Gabinete" },
  { value: "entrega", label: "Entrega" },
  { value: "administrativo", label: "Administrativo" }
];

function getTarefaInicial() {
  return {
    titulo: "",
    projetoId: "",
    projetoNome: "",
    fase: "planejamento",
    responsavel: "",
    responsavelUid: "",
    responsavelEmail: "",
    dataInicio: "",
    dataVencimento: "",
    status: "a_fazer",
    prioridade: "media",
    descricao: "",
    subtarefas: []
  };
}

function ensureDraftSubtarefas() {
  const tarefaEditando = state.tarefaEditandoId ? getTarefaById(state.tarefaEditandoId) : null;

  if (tarefaEditando) {
    draftSubtarefas = Array.isArray(tarefaEditando.subtarefas)
      ? tarefaEditando.subtarefas.map((item) => ({
          texto: item?.texto || "",
          concluida: Boolean(item?.concluida)
        }))
      : [];
    return;
  }

  draftSubtarefas = [];
}

export function openTarefaEditor(taskId, options = {}) {
  const { scrollToTop = true } = options;

  if (!taskId) return;

  setTarefaEditandoId(taskId);
  ensureDraftSubtarefas();
  renderTarefasView();

  if (scrollToTop) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatStatus(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || "Sem status";
}

function formatPrioridade(prioridade) {
  return PRIORIDADE_OPTIONS.find((item) => item.value === prioridade)?.label || "Sem prioridade";
}

function formatFase(fase) {
  return FASE_OPTIONS.find((item) => item.value === fase)?.label || "Sem fase";
}

function formatDate(value) {
  if (!value) return "Não informado";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function getProjetoById(id) {
  return state.projetos.find((item) => item.id === id) || null;
}

function getTarefaById(id) {
  return state.tarefas.find((item) => item.id === id) || null;
}

function getUserById(id) {
  return state.users.find((item) => item.id === id) || null;
}

function getResponsaveisDisponiveis() {
  const itens = state.tarefas
    .map((item) => (item.responsavel || "").trim())
    .filter(Boolean);

  return [...new Set(itens)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function getTarefasFiltradas() {
  return state.tarefas.filter((item) => {
    if (!state.mostrarTarefasArquivadas && item.arquivada) return false;
    if (state.filtroProjetoTarefa !== "todos" && item.projetoId !== state.filtroProjetoTarefa) return false;
    if (state.filtroStatusTarefa !== "todos" && item.status !== state.filtroStatusTarefa) return false;
    if (state.filtroFaseTarefa !== "todos" && item.fase !== state.filtroFaseTarefa) return false;
    if (
      state.filtroResponsavelTarefa !== "todos" &&
      (item.responsavel || "").trim() !== state.filtroResponsavelTarefa
    ) {
      return false;
    }
    return true;
  });
}

function getPrazoBadge(item) {
  if (!item.dataVencimento || item.status === "concluida" || item.arquivada) return "";

  const hoje = new Date();
  const baseHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const venc = new Date(`${item.dataVencimento}T00:00:00`);
  const diffDias = Math.round((venc - baseHoje) / 86400000);

  if (diffDias < 0) {
    return '<span class="cronograma-tag cronograma-tag--danger">Atrasada</span>';
  }

  if (diffDias <= 3) {
    return '<span class="cronograma-tag cronograma-tag--warning">Prazo próximo</span>';
  }

  return "";
}

function getChecklistResumo(item) {
  const total = Array.isArray(item.subtarefas) ? item.subtarefas.length : 0;
  const concluidas = total
    ? item.subtarefas.filter((sub) => sub?.concluida).length
    : 0;

  if (!total) return "";
  return `<span class="cronograma-tag cronograma-tag--info">Checklist ${concluidas}/${total}</span>`;
}

function renderChecklistDraft() {
  if (!draftSubtarefas.length) {
    return `<div class="cronograma-subtasks-empty">Nenhuma subtarefa adicionada.</div>`;
  }

  return `
    <div class="cronograma-subtasks-list">
      ${draftSubtarefas
        .map(
          (item, index) => `
            <div class="cronograma-subtask-row">
              <label class="cronograma-subtask-label">
                <input type="checkbox" data-action="toggle-draft-subtarefa" data-index="${index}" ${item.concluida ? "checked" : ""} />
                <span class="${item.concluida ? "is-done" : ""}">${escapeHtml(item.texto)}</span>
              </label>
              <button class="cronograma-btn cronograma-btn--ghost cronograma-btn--xs" type="button" data-action="remove-draft-subtarefa" data-index="${index}">
                Remover
              </button>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderChecklistCard(item) {
  if (!Array.isArray(item.subtarefas) || !item.subtarefas.length) return "";

  return `
    <div class="cronograma-task-checklist">
      <strong>Checklist</strong>
      <div class="cronograma-task-checklist__items">
        ${item.subtarefas
          .map(
            (sub, index) => `
              <label class="cronograma-task-checklist__item">
                <input
                  type="checkbox"
                  data-action="toggle-subtarefa-card"
                  data-task-id="${item.id}"
                  data-index="${index}"
                  ${sub?.concluida ? "checked" : ""}
                />
                <span class="${sub?.concluida ? "is-done" : ""}">${escapeHtml(sub?.texto || "")}</span>
              </label>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}
function renderTarefaCard(item) {
  const statusLabel = formatStatus(item.status);
  const prioridadeLabel = formatPrioridade(item.prioridade);
  const faseLabel = formatFase(item.fase);
  const dataInicioLabel = formatDate(item.dataInicio);
  const dataVencimentoLabel = formatDate(item.dataVencimento);

  const isAtrasada =
    item.dataVencimento &&
    item.status !== "concluida" &&
    !item.arquivada &&
    new Date(`${item.dataVencimento}T00:00:00`) <
      new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return `
    <article class="cronograma-task-card ${item.arquivada ? "is-archived" : ""} ${isAtrasada ? "is-overdue" : ""}">
      <div class="cronograma-task-card__topline">
        <div class="cronograma-task-card__project">
          <span class="cronograma-task-card__project-label">Projeto</span>
          <strong>${escapeHtml(item.projetoNome || "Projeto não informado")}</strong>
        </div>

        <div class="cronograma-tag-row cronograma-tag-row--tight">
          <span class="cronograma-tag">${escapeHtml(faseLabel)}</span>
          <button
            class="cronograma-tag cronograma-tag--clickable"
            data-action="cycle-status"
            data-id="${item.id}"
          >
            ${escapeHtml(statusLabel)}
          </button>
          
          <button
            class="cronograma-tag cronograma-tag--clickable"
            data-action="cycle-prioridade"
            data-id="${item.id}"
          >
            ${escapeHtml(prioridadeLabel)}
          </button>
          ${getChecklistResumo(item)}
          ${getPrazoBadge(item)}
          ${item.arquivada ? '<span class="cronograma-tag cronograma-tag--muted">Arquivada</span>' : ""}
        </div>
      </div>

      <div class="cronograma-task-card__head">
        <div>
          <h3>${escapeHtml(item.titulo)}</h3>
        </div>
      </div>

      <div class="cronograma-task-card__meta cronograma-task-card__meta--grid">
        <div class="cronograma-task-meta-box">
          <span class="cronograma-task-meta-box__label">Responsável</span>
          <strong>${escapeHtml(item.responsavel || "—")}</strong>
        </div>

        <div class="cronograma-task-meta-box">
          <span class="cronograma-task-meta-box__label">Início</span>
          <strong>${escapeHtml(dataInicioLabel)}</strong>
        </div>

        <div class="cronograma-task-meta-box">
          <span class="cronograma-task-meta-box__label">Vencimento</span>
          <strong>${escapeHtml(dataVencimentoLabel)}</strong>
        </div>
      </div>

      ${
        item.descricao
          ? `<div class="cronograma-task-card__description-block">
              <span class="cronograma-task-card__section-label">Descrição</span>
              <p class="cronograma-task-card__desc">${escapeHtml(item.descricao)}</p>
            </div>`
          : ""
      }

      ${renderChecklistCard(item)}

      <div class="cronograma-task-card__actions">
        <button class="cronograma-btn cronograma-btn--ghost" type="button" data-action="editar-tarefa" data-id="${item.id}">
          Editar
        </button>

        ${
          item.arquivada
            ? `<button class="cronograma-btn cronograma-btn--secondary" type="button" data-action="desarquivar-tarefa" data-id="${item.id}">
                Desarquivar
              </button>`
            : `<button class="cronograma-btn cronograma-btn--secondary" type="button" data-action="arquivar-tarefa" data-id="${item.id}">
                Arquivar
              </button>`
        }
      </div>
    </article>
  `;
}

function getTarefaFormPanel(tarefaEditando, tarefaBase, options = {}) {
  const { modal = false } = options;

  return `
    <section class="cronograma-panel">
      <div class="cronograma-section-head">
        <div>
          <p class="cronograma-section-head__eyebrow">${modal ? "Edição" : "Cadastro"}</p>
          <h2>${tarefaEditando ? "Editar tarefa" : "Nova tarefa"}</h2>
        </div>
      </div>

      ${
        !state.projetosLoaded
          ? `<div class="cronograma-empty-state">Carregando projetos para vinculação...</div>`
          : !state.projetos.length
            ? `<div class="cronograma-empty-state">Cadastre ao menos um projeto antes de criar tarefas.</div>`
            : !state.usersLoaded
              ? `<div class="cronograma-empty-state">Carregando usuários para seleção do responsável...</div>`
              : !state.users.length
                ? `<div class="cronograma-empty-state">Nenhum usuário disponível na coleção users.</div>`
                : `
                  <form id="tarefaForm" class="cronograma-form">
                    <div class="cronograma-form-grid">
                      <label class="cronograma-field">
                        <span>Título da tarefa *</span>
                        <input type="text" name="titulo" value="${escapeHtml(tarefaBase.titulo)}" required />
                      </label>

                      <label class="cronograma-field">
                        <span>Projeto *</span>
                        <select name="projetoId" required>
                          <option value="">Selecione</option>
                          ${state.projetos
                            .filter((item) => !item.arquivado)
                            .map(
                              (item) => `
                                <option value="${item.id}" ${tarefaBase.projetoId === item.id ? "selected" : ""}>
                                  ${escapeHtml(item.nome)}
                                </option>
                              `
                            )
                            .join("")}
                        </select>
                      </label>

                      <label class="cronograma-field">
                        <span>Fase</span>
                        <select name="fase">
                          ${FASE_OPTIONS.map(
                            (opt) => `
                              <option value="${opt.value}" ${tarefaBase.fase === opt.value ? "selected" : ""}>
                                ${opt.label}
                              </option>
                            `
                          ).join("")}
                        </select>
                      </label>

                      <label class="cronograma-field">
                        <span>Responsável *</span>
                        <select name="responsavelUid" required>
                          <option value="">Selecione</option>
                          ${state.users.map(
                            (item) => `
                              <option value="${item.id}" ${tarefaBase.responsavelUid === item.id ? "selected" : ""}>
                                ${escapeHtml(item.nome)}${item.email ? ` — ${escapeHtml(item.email)}` : ""}
                              </option>
                            `
                          ).join("")}
                        </select>
                      </label>

                      <label class="cronograma-field">
                        <span>Status</span>
                        <select name="status">
                          ${STATUS_OPTIONS.map(
                            (opt) => `
                              <option value="${opt.value}" ${tarefaBase.status === opt.value ? "selected" : ""}>
                                ${opt.label}
                              </option>
                            `
                          ).join("")}
                        </select>
                      </label>

                      <label class="cronograma-field">
                        <span>Prioridade</span>
                        <select name="prioridade">
                          ${PRIORIDADE_OPTIONS.map(
                            (opt) => `
                              <option value="${opt.value}" ${tarefaBase.prioridade === opt.value ? "selected" : ""}>
                                ${opt.label}
                              </option>
                            `
                          ).join("")}
                        </select>
                      </label>

                      <label class="cronograma-field">
                        <span>Data de início</span>
                        <input type="date" name="dataInicio" value="${escapeHtml(tarefaBase.dataInicio)}" />
                      </label>

                      <label class="cronograma-field">
                        <span>Data de vencimento</span>
                        <input type="date" name="dataVencimento" value="${escapeHtml(tarefaBase.dataVencimento)}" />
                      </label>
                    </div>

                    <label class="cronograma-field">
                      <span>Descrição</span>
                      <textarea name="descricao" rows="5">${escapeHtml(tarefaBase.descricao)}</textarea>
                    </label>

                    <div class="cronograma-field">
                      <span>Checklist / subtarefas</span>
                      <div class="cronograma-subtasks-builder">
                        <div class="cronograma-subtasks-input-row">
                          <input type="text" id="novaSubtarefaTexto" placeholder="Ex.: Solicitar acesso à área" />
                          <button class="cronograma-btn cronograma-btn--secondary" type="button" id="btnAdicionarSubtarefa">
                            Adicionar
                          </button>
                        </div>
                        <div id="subtarefasDraftContainer">
                          ${renderChecklistDraft()}
                        </div>
                      </div>
                    </div>

                    <div class="cronograma-form-actions">
                      <button class="cronograma-btn cronograma-btn--primary" type="submit">
                        ${tarefaEditando ? "Salvar alterações" : "Cadastrar tarefa"}
                      </button>

                      ${
                        tarefaEditando
                          ? `<button class="cronograma-btn cronograma-btn--ghost" type="button" id="btnCancelarEdicaoTarefa">
                              ${modal ? "Fechar" : "Cancelar edição"}
                            </button>`
                          : ""
                      }
                    </div>

                    <p class="cronograma-form-feedback" id="tarefaFormFeedback"></p>
                  </form>
                `
      }
    </section>
  `;
}

function getTarefasTemplate() {
  const tarefas = getTarefasFiltradas();
  const responsaveis = getResponsaveisDisponiveis();
  const tarefaEditando = state.tarefaEditandoId ? getTarefaById(state.tarefaEditandoId) : null;
  const tarefaBase = tarefaEditando || getTarefaInicial();

  return `
    <section class="cronograma-tarefas-page">
      <div class="cronograma-view-grid cronograma-view-grid--tasks">
        ${getTarefaFormPanel(tarefaEditando, tarefaBase)}

        <section class="cronograma-panel">
          <div class="cronograma-section-head cronograma-section-head--stack-mobile">
            <div>
              <p class="cronograma-section-head__eyebrow">Consulta</p>
              <h2>Tarefas cadastradas</h2>
            </div>

            <div class="cronograma-filter-row cronograma-filter-row--wide">
              <label class="cronograma-field cronograma-field--compact">
                <span>Projeto</span>
                <select id="filtroProjetoTarefa">
                  <option value="todos" ${state.filtroProjetoTarefa === "todos" ? "selected" : ""}>Todos</option>
                  ${state.projetos.map(
                    (item) => `
                      <option value="${item.id}" ${state.filtroProjetoTarefa === item.id ? "selected" : ""}>
                        ${escapeHtml(item.nome)}
                      </option>
                    `
                  ).join("")}
                </select>
              </label>

              <label class="cronograma-field cronograma-field--compact">
                <span>Fase</span>
                <select id="filtroFaseTarefa">
                  <option value="todos" ${state.filtroFaseTarefa === "todos" ? "selected" : ""}>Todas</option>
                  ${FASE_OPTIONS.map(
                    (opt) => `
                      <option value="${opt.value}" ${state.filtroFaseTarefa === opt.value ? "selected" : ""}>
                        ${opt.label}
                      </option>
                    `
                  ).join("")}
                </select>
              </label>

              <label class="cronograma-field cronograma-field--compact">
                <span>Status</span>
                <select id="filtroStatusTarefa">
                  <option value="todos" ${state.filtroStatusTarefa === "todos" ? "selected" : ""}>Todos</option>
                  ${STATUS_OPTIONS.map(
                    (opt) => `
                      <option value="${opt.value}" ${state.filtroStatusTarefa === opt.value ? "selected" : ""}>
                        ${opt.label}
                      </option>
                    `
                  ).join("")}
                </select>
              </label>

              <label class="cronograma-field cronograma-field--compact">
                <span>Responsável</span>
                <select id="filtroResponsavelTarefa">
                  <option value="todos" ${state.filtroResponsavelTarefa === "todos" ? "selected" : ""}>Todos</option>
                  ${responsaveis.map(
                    (item) => `
                      <option value="${escapeHtml(item)}" ${state.filtroResponsavelTarefa === item ? "selected" : ""}>
                        ${escapeHtml(item)}
                      </option>
                    `
                  ).join("")}
                </select>
              </label>

              <label class="cronograma-check">
                <input type="checkbox" id="mostrarTarefasArquivadas" ${state.mostrarTarefasArquivadas ? "checked" : ""} />
                <span>Mostrar arquivadas</span>
              </label>
            </div>
          </div>

          ${
            !state.tarefasLoaded
              ? `<div class="cronograma-empty-state">Carregando tarefas...</div>`
              : tarefas.length
                ? `<div class="cronograma-task-list">${tarefas.map(renderTarefaCard).join("")}</div>`
                : `<div class="cronograma-empty-state">Nenhuma tarefa encontrada com os filtros atuais.</div>`
          }
        </section>
      </div>
    </section>
  `;
}

function getTarefaEditorTemplate() {
  const tarefaEditando = state.tarefaEditandoId ? getTarefaById(state.tarefaEditandoId) : null;
  const tarefaBase = tarefaEditando || getTarefaInicial();

  return `
    <section class="cronograma-tarefas-page cronograma-tarefas-page--modal">
      <div class="cronograma-view-grid">
        ${getTarefaFormPanel(tarefaEditando, tarefaBase, { modal: true })}
      </div>
    </section>
  `;
}
function rerenderDraftChecklist(root = document) {
  const container = root.querySelector("#subtarefasDraftContainer");
  if (container) {
    container.innerHTML = renderChecklistDraft();
    bindDraftChecklistEvents(root);
  }
}

function bindDraftChecklistEvents(root = document) {
  root.querySelectorAll('[data-action="toggle-draft-subtarefa"]').forEach((input) => {
    input.addEventListener("change", () => {
      const index = Number(input.dataset.index);
      if (Number.isNaN(index) || !draftSubtarefas[index]) return;
      draftSubtarefas[index].concluida = input.checked;
      rerenderDraftChecklist(root);
    });
  });

  root.querySelectorAll('[data-action="remove-draft-subtarefa"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      if (Number.isNaN(index)) return;
      draftSubtarefas.splice(index, 1);
      rerenderDraftChecklist(root);
    });
  });
}

async function toggleChecklistCard(taskId, index, checked) {
  const tarefa = getTarefaById(taskId);
  if (!tarefa || !Array.isArray(tarefa.subtarefas) || !tarefa.subtarefas[index]) return;

  const novasSubtarefas = tarefa.subtarefas.map((item, idx) => ({
    texto: item?.texto || "",
    concluida: idx === index ? checked : Boolean(item?.concluida)
  }));

  try {
    await alternarSubtarefa(taskId, novasSubtarefas);
  } catch (error) {
    console.error(error);
    window.alert(error.message || "Não foi possível atualizar o checklist.");
  }
}

function mountTarefasEvents(root = document, options = {}) {
  const {
    preserveEditStateAfterSave = false,
    onAfterSave = null,
    onCancelEdit = null
  } = options;

  const form = root.querySelector("#tarefaForm");
  const feedback = root.querySelector("#tarefaFormFeedback");
  const btnCancelar = root.querySelector("#btnCancelarEdicaoTarefa");
  const filtroProjeto = root.querySelector("#filtroProjetoTarefa");
  const filtroFase = root.querySelector("#filtroFaseTarefa");
  const filtroStatus = root.querySelector("#filtroStatusTarefa");
  const filtroResponsavel = root.querySelector("#filtroResponsavelTarefa");
  const mostrarArquivadas = root.querySelector("#mostrarTarefasArquivadas");
  const btnAdicionarSubtarefa = root.querySelector("#btnAdicionarSubtarefa");
  const inputNovaSubtarefa = root.querySelector("#novaSubtarefaTexto");

  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      if (typeof onCancelEdit === "function") {
        onCancelEdit();
        return;
      }

      setTarefaEditandoId(null);
      draftSubtarefas = [];
      renderTarefasView();
    });
  }

  if (filtroProjeto) {
    filtroProjeto.addEventListener("change", (event) => {
      setFiltroProjetoTarefa(event.target.value);
      renderTarefasView();
    });
  }

  if (filtroFase) {
    filtroFase.addEventListener("change", (event) => {
      setFiltroFaseTarefa(event.target.value);
      renderTarefasView();
    });
  }

  if (filtroStatus) {
    filtroStatus.addEventListener("change", (event) => {
      setFiltroStatusTarefa(event.target.value);
      renderTarefasView();
    });
  }

  if (filtroResponsavel) {
    filtroResponsavel.addEventListener("change", (event) => {
      setFiltroResponsavelTarefa(event.target.value);
      renderTarefasView();
    });
  }

  if (mostrarArquivadas) {
    mostrarArquivadas.addEventListener("change", (event) => {
      setMostrarTarefasArquivadas(event.target.checked);
      renderTarefasView();
    });
  }

  if (btnAdicionarSubtarefa && inputNovaSubtarefa) {
    btnAdicionarSubtarefa.addEventListener("click", () => {
      const texto = (inputNovaSubtarefa.value || "").trim();
      if (!texto) return;

      draftSubtarefas.push({
        texto,
        concluida: false
      });

      inputNovaSubtarefa.value = "";
      rerenderDraftChecklist(root);
      inputNovaSubtarefa.focus();
    });

    inputNovaSubtarefa.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        btnAdicionarSubtarefa.click();
      }
    });
  }

  bindDraftChecklistEvents(root);
  
  root.querySelectorAll('[data-action="toggle-subtarefa-card"]').forEach((input) => {
    input.addEventListener("change", () => {
      toggleChecklistCard(input.dataset.taskId, Number(input.dataset.index), input.checked);
    });
  });

  const clickRoot = root.querySelector(".cronograma-tarefas-page") || root;
  
  clickRoot.addEventListener("click", async (e) => {
    const statusBtn = e.target.closest('[data-action="cycle-status"]');
    if (statusBtn && clickRoot.contains(statusBtn)) {
      const tarefa = getTarefaById(statusBtn.dataset.id);
      if (!tarefa) return;
  
      const ordem = ["a_fazer", "andamento", "acompanhando", "concluida"];
      const atualIndex = ordem.indexOf(tarefa.status);
      const proximo = ordem[(atualIndex + 1) % ordem.length];
  
      try {
        await atualizarTarefa(tarefa.id, {
          ...tarefa,
          status: proximo
        });
      } catch (err) {
        console.error(err);
        alert("Erro ao atualizar status");
      }
      return;
    }
  
    const prioridadeBtn = e.target.closest('[data-action="cycle-prioridade"]');
    if (prioridadeBtn && clickRoot.contains(prioridadeBtn)) {
      const tarefa = getTarefaById(prioridadeBtn.dataset.id);
      if (!tarefa) return;
  
      const ordem = ["baixa", "media", "alta", "critica"];
      const atualIndex = ordem.indexOf(tarefa.prioridade);
      const proximo = ordem[(atualIndex + 1) % ordem.length];
  
      try {
        await atualizarTarefa(tarefa.id, {
          ...tarefa,
          prioridade: proximo
        });
      } catch (err) {
        console.error(err);
        alert("Erro ao atualizar prioridade");
      }
    }
  });
  
  root.querySelectorAll('[data-action="editar-tarefa"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      openTarefaEditor(btn.dataset.id);
    });
  });

  root.querySelectorAll('[data-action="arquivar-tarefa"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = window.confirm("Arquivar esta tarefa? Ela continuará disponível para consulta.");
      if (!ok) return;

      try {
        await arquivarTarefa(btn.dataset.id);
      } catch (error) {
        console.error(error);
        window.alert(error.message || "Não foi possível arquivar a tarefa.");
      }
    });
  });

  root.querySelectorAll('[data-action="desarquivar-tarefa"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await desarquivarTarefa(btn.dataset.id);
      } catch (error) {
        console.error(error);
        window.alert(error.message || "Não foi possível desarquivar a tarefa.");
      }
    });
  });

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const projetoId = formData.get("projetoId");
      const projeto = getProjetoById(projetoId);
      const responsavelUid = formData.get("responsavelUid");
      const responsavelUser = getUserById(responsavelUid);

      const payload = {
        titulo: formData.get("titulo"),
        projetoId,
        projetoNome: projeto?.nome || "",
        fase: formData.get("fase"),
        responsavel: responsavelUser?.nome || "",
        responsavelUid: responsavelUser?.uid || "",
        responsavelEmail: responsavelUser?.email || "",
        dataInicio: formData.get("dataInicio"),
        dataVencimento: formData.get("dataVencimento"),
        status: formData.get("status"),
        prioridade: formData.get("prioridade"),
        descricao: formData.get("descricao"),
        subtarefas: draftSubtarefas
      };

      if (feedback) {
        feedback.textContent = "Salvando tarefa...";
        feedback.classList.remove("is-error", "is-success");
      }

      try {
        if (state.tarefaEditandoId) {
          const editedTaskId = state.tarefaEditandoId;
          await atualizarTarefa(editedTaskId, payload);

          if (!preserveEditStateAfterSave) {
            setTarefaEditandoId(null);
            draftSubtarefas = [];
          }

          if (feedback) {
            feedback.textContent = "Tarefa atualizada com sucesso.";
            feedback.classList.add("is-success");
          }

          if (typeof onAfterSave === "function") {
            onAfterSave({ taskId: editedTaskId, mode: "edit" });
          }

          if (!preserveEditStateAfterSave && root === document) {
            renderTarefasView();
          }
        } else {
          await criarTarefa(payload);
          form.reset();
          draftSubtarefas = [];
          rerenderDraftChecklist(root);

          if (feedback) {
            feedback.textContent = "Tarefa cadastrada com sucesso.";
            feedback.classList.add("is-success");
          }

          if (typeof onAfterSave === "function") {
            onAfterSave({ taskId: null, mode: "create" });
          }
        }
      } catch (error) {
        console.error(error);
        if (feedback) {
          feedback.textContent = error.message || "Não foi possível salvar a tarefa.";
          feedback.classList.add("is-error");
        }
      }
    });
  }
}

function ensureTarefasListener() {
  if (unsubscribeTarefas) return;

  unsubscribeTarefas = listenTarefas(
    (items) => {
      setTarefas(items);

      if (state.currentView === "tarefas") {
        renderTarefasView();
      }
    },
    (error) => {
      console.error(error);
      setTarefas([]);
      if (state.currentView === "tarefas") {
        renderIntoApp(`
          <section class="cronograma-panel">
            <div class="cronograma-empty-state cronograma-empty-state--error">
              Não foi possível carregar as tarefas no Firestore.
            </div>
          </section>
        `);
      }
    }
  );
}

function ensureUsersListener() {
  if (unsubscribeUsers) return;

  unsubscribeUsers = listenUsers(
    (items) => {
      setUsers(items);

      if (state.currentView === "tarefas") {
        renderTarefasView();
      }
    },
    (error) => {
      console.error(error);
      setUsers([]);
      if (state.currentView === "tarefas") {
        renderIntoApp(`
          <section class="cronograma-panel">
            <div class="cronograma-empty-state cronograma-empty-state--error">
              Não foi possível carregar os usuários no Firestore.
            </div>
          </section>
        `);
      }
    }
  );
}
export function renderTarefaEditorInContainer(container, taskId, options = {}) {
  if (!container) return;

  ensureProjetosListener();
  ensureUsersListener();
  ensureTarefasListener();

  setTarefaEditandoId(taskId);
  ensureDraftSubtarefas();

  container.innerHTML = getTarefaEditorTemplate();

  mountTarefasEvents(container, {
    preserveEditStateAfterSave: true,
    onAfterSave: options.onAfterSave || null,
    onCancelEdit: options.onCancelEdit || null
  });
}

export function renderTarefasView() {
  ensureProjetosListener();
  ensureUsersListener();
  ensureTarefasListener();

  if (!state.tarefaEditandoId && !draftSubtarefas.length) {
    ensureDraftSubtarefas();
  }

  renderIntoApp(getTarefasTemplate());
  mountTarefasEvents(document);
}
