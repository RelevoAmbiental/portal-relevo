import { renderIntoApp } from "../ui/layout.js";
import {
  state,
  setTarefas,
  setTarefaEditandoId,
  setMostrarTarefasArquivadas,
  setFiltroProjetoTarefa,
  setFiltroStatusTarefa,
  setFiltroResponsavelTarefa
} from "../core/state.js";
import {
  listenTarefas,
  criarTarefa,
  atualizarTarefa,
  arquivarTarefa,
  desarquivarTarefa
} from "../services/firestore-tarefas.js";
import { ensureProjetosListener } from "./projetos.js";

let unsubscribeTarefas = null;

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

function getTarefaInicial() {
  return {
    titulo: "",
    projetoId: "",
    projetoNome: "",
    responsavel: "",
    dataInicio: "",
    dataVencimento: "",
    status: "a_fazer",
    prioridade: "media",
    descricao: ""
  };
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

function renderTarefaCard(item) {
  return `
    <article class="cronograma-task-card ${item.arquivada ? "is-archived" : ""}">
      <div class="cronograma-task-card__head">
        <div>
          <h3>${escapeHtml(item.titulo)}</h3>
          <p>${escapeHtml(item.projetoNome || "Projeto não informado")}</p>
        </div>

        <div class="cronograma-tag-row cronograma-tag-row--tight">
          <span class="cronograma-tag">${escapeHtml(formatStatus(item.status))}</span>
          <span class="cronograma-tag">${escapeHtml(formatPrioridade(item.prioridade))}</span>
          ${getPrazoBadge(item)}
          ${item.arquivada ? '<span class="cronograma-tag cronograma-tag--muted">Arquivada</span>' : ""}
        </div>
      </div>

      <div class="cronograma-task-card__meta">
        <div><strong>Responsável:</strong> ${escapeHtml(item.responsavel || "—")}</div>
        <div><strong>Início:</strong> ${escapeHtml(formatDate(item.dataInicio))}</div>
        <div><strong>Vencimento:</strong> ${escapeHtml(formatDate(item.dataVencimento))}</div>
      </div>

      ${
        item.descricao
          ? `<p class="cronograma-task-card__desc">${escapeHtml(item.descricao)}</p>`
          : ""
      }

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

function getTarefasTemplate() {
  const tarefas = getTarefasFiltradas();
  const responsaveis = getResponsaveisDisponiveis();
  const tarefaEditando = state.tarefaEditandoId ? getTarefaById(state.tarefaEditandoId) : null;
  const tarefaBase = tarefaEditando || getTarefaInicial();

  return `
    <section class="cronograma-tarefas-page">
      <div class="cronograma-view-grid cronograma-view-grid--tasks">
        <section class="cronograma-panel">
          <div class="cronograma-section-head">
            <div>
              <p class="cronograma-section-head__eyebrow">Cadastro</p>
              <h2>${tarefaEditando ? "Editar tarefa" : "Nova tarefa"}</h2>
            </div>
          </div>

          ${
            !state.projetosLoaded
              ? `<div class="cronograma-empty-state">Carregando projetos para vinculação...</div>`
              : !state.projetos.length
                ? `<div class="cronograma-empty-state">Cadastre ao menos um projeto antes de criar tarefas.</div>`
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
                        <span>Responsável</span>
                        <input type="text" name="responsavel" value="${escapeHtml(tarefaBase.responsavel)}" />
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

                    <div class="cronograma-form-actions">
                      <button class="cronograma-btn cronograma-btn--primary" type="submit">
                        ${tarefaEditando ? "Salvar alterações" : "Cadastrar tarefa"}
                      </button>

                      ${
                        tarefaEditando
                          ? `<button class="cronograma-btn cronograma-btn--ghost" type="button" id="btnCancelarEdicaoTarefa">
                              Cancelar edição
                            </button>`
                          : ""
                      }
                    </div>

                    <p class="cronograma-form-feedback" id="tarefaFormFeedback"></p>
                  </form>
                `
          }
        </section>

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

function mountTarefasEvents() {
  const form = document.getElementById("tarefaForm");
  const feedback = document.getElementById("tarefaFormFeedback");
  const btnCancelar = document.getElementById("btnCancelarEdicaoTarefa");
  const filtroProjeto = document.getElementById("filtroProjetoTarefa");
  const filtroStatus = document.getElementById("filtroStatusTarefa");
  const filtroResponsavel = document.getElementById("filtroResponsavelTarefa");
  const mostrarArquivadas = document.getElementById("mostrarTarefasArquivadas");

  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      setTarefaEditandoId(null);
      renderTarefasView();
    });
  }

  if (filtroProjeto) {
    filtroProjeto.addEventListener("change", (event) => {
      setFiltroProjetoTarefa(event.target.value);
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

  document.querySelectorAll('[data-action="editar-tarefa"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      setTarefaEditandoId(btn.dataset.id);
      renderTarefasView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll('[data-action="arquivar-tarefa"]').forEach((btn) => {
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

  document.querySelectorAll('[data-action="desarquivar-tarefa"]').forEach((btn) => {
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

      const payload = {
        titulo: formData.get("titulo"),
        projetoId,
        projetoNome: projeto?.nome || "",
        responsavel: formData.get("responsavel"),
        dataInicio: formData.get("dataInicio"),
        dataVencimento: formData.get("dataVencimento"),
        status: formData.get("status"),
        prioridade: formData.get("prioridade"),
        descricao: formData.get("descricao")
      };

      if (feedback) {
        feedback.textContent = "Salvando tarefa...";
        feedback.classList.remove("is-error", "is-success");
      }

      try {
        if (state.tarefaEditandoId) {
          await atualizarTarefa(state.tarefaEditandoId, payload);
          setTarefaEditandoId(null);
          if (feedback) {
            feedback.textContent = "Tarefa atualizada com sucesso.";
            feedback.classList.add("is-success");
          }
        } else {
          await criarTarefa(payload);
          form.reset();
          if (feedback) {
            feedback.textContent = "Tarefa cadastrada com sucesso.";
            feedback.classList.add("is-success");
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

export function renderTarefasView() {
  ensureProjetosListener();
  ensureTarefasListener();
  renderIntoApp(getTarefasTemplate());
  mountTarefasEvents();
}
