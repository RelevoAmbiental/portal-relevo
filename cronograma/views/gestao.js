import { renderIntoApp } from "../ui/layout.js";
import {
  state,
  setProjetos,
  setTarefas,
  setUsers
} from "../core/state.js";
import { listenProjetos } from "../services/firestore-projetos.js";
import { listenTarefas } from "../services/firestore-tarefas.js";
import { listenUsers } from "../services/firestore-users.js";
import {
  countUniqueResponsaveis,
  getDateRangeForTask,
  getTodayKey,
  isTaskOverdue,
  isTaskUpcoming,
  sortCalendarTasks,
  parseDateKey
} from "../core/calendar-utils.js";

let unsubscribeTarefas = null;
let unsubscribeUsers = null;
let unsubscribeProjetos = null;

const gestaoUiState = {
  filterType: "all",
  filterValue: "",
  sortMode: "risk"
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatResponsavel(task) {
  return (task.responsavel || "").trim() || "Sem responsável";
}

function formatProjeto(task) {
  return (task.projetoNome || "").trim() || "Sem projeto";
}

function formatPrioridade(value) {
  const map = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    critica: "Crítica"
  };

  return map[value] || "Sem prioridade";
}

function formatStatus(value) {
  const map = {
    a_fazer: "A fazer",
    andamento: "Em andamento",
    acompanhando: "Acompanhando",
    concluida: "Concluída"
  };

  return map[value] || "Sem status";
}

function getPriorityWeight(value) {
  const map = {
    critica: 4,
    alta: 3,
    media: 2,
    baixa: 1
  };

  return map[value] || 0;
}

function getDaysDiff(fromKey, toKey) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);

  if (!from || !to) return null;

  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((b - a) / 86400000);
}

function getTaskRiskScore(task, today = getTodayKey()) {
  let score = 0;

  score += getPriorityWeight(task.prioridade) * 3;

  if (isTaskOverdue(task, today)) {
    const overdueDays = Math.abs(getDaysDiff(task.dataVencimento, today) || 0);
    score += 15 + Math.min(overdueDays, 10);
  } else if (isTaskUpcoming(task, today, 7)) {
    const daysLeft = getDaysDiff(today, task.dataVencimento);
    score += 8 - Math.min(Math.max(daysLeft ?? 7, 0), 7);
  }

  if (formatResponsavel(task) === "Sem responsável") {
    score += 4;
  }

  if (task.status === "andamento") {
    score += 2;
  }

  if (task.status === "acompanhando") {
    score += 1;
  }

  return score;
}

function getFilteredGestaoTasks() {
  const projetosMap = new Map(
    (state.projetos || []).map((projeto) => [
      projeto.id || projeto.nome,
      projeto
    ])
  );

  return sortCalendarTasks(
    (state.tarefas || [])
      .filter((task) => {
        if (task.arquivada) return false;
        if (task.status === "concluida") return false;
        return Boolean(getDateRangeForTask(task));
      })
      .map((task) => {
        const projectKey = task.projetoId || task.projetoNome;
        const projeto = projetosMap.get(projectKey);

        return {
          ...task,
          projetoCor: task.projetoCor || projeto?.cor || "#cfd8d3"
        };
      })
  );
}

function splitTasksIntoRows(tasks) {
  const rows = [];

  tasks
    .filter((task) => getDateRangeForTask(task))
    .sort((a, b) => {
      const ra = getDateRangeForTask(a);
      const rb = getDateRangeForTask(b);
      return ra.start - rb.start;
    })
    .forEach((task) => {
      const range = getDateRangeForTask(task);
      const start = range.start;
      const end = range.end;

      let placed = false;

      for (const row of rows) {
        const conflict = row.some((existing) => {
          const r = getDateRangeForTask(existing);
          return !(end < r.start || start > r.end);
        });

        if (!conflict) {
          row.push(task);
          placed = true;
          break;
        }
      }

      if (!placed) {
        rows.push([task]);
      }
    });

  return rows;
}

function getResponsavelTimelineStats(tasks) {
  const taskRows = splitTasksIntoRows(tasks);
  const totalTasks = tasks.length;
  const concurrentFronts = taskRows.length;
  const hasConflict = concurrentFronts > 1;

  let conflictLevel = "none";
  if (concurrentFronts >= 3) {
    conflictLevel = "high";
  } else if (concurrentFronts === 2) {
    conflictLevel = "medium";
  }

  return {
    taskRows,
    totalTasks,
    concurrentFronts,
    hasConflict,
    conflictLevel
  };
}

function getGestaoMetrics(tasks) {
  const today = getTodayKey();

  const overdue = tasks.filter((task) => isTaskOverdue(task, today));
  const highPriority = tasks.filter((task) => ["alta", "critica"].includes(task.prioridade));
  const upcoming = tasks.filter((task) => isTaskUpcoming(task, today, 7));

  const responsavelMap = new Map();

  tasks.forEach((task) => {
    const responsavel = formatResponsavel(task);

    if (!responsavelMap.has(responsavel)) {
      responsavelMap.set(responsavel, []);
    }

    responsavelMap.get(responsavel).push(task);
  });

  const responsaveis = [...responsavelMap.entries()]
    .map(([nome, responsavelTasks]) => {
      const stats = getResponsavelTimelineStats(responsavelTasks);
      const riskScore = responsavelTasks.reduce((sum, task) => sum + getTaskRiskScore(task, today), 0);

      return {
        nome,
        total: responsavelTasks.length,
        overdue: responsavelTasks.filter((task) => isTaskOverdue(task, today)).length,
        upcoming: responsavelTasks.filter((task) => isTaskUpcoming(task, today, 7)).length,
        fronts: stats.concurrentFronts,
        hasConflict: stats.hasConflict,
        conflictLevel: stats.conflictLevel,
        riskScore
      };
    })
    .sort((a, b) =>
      b.overdue - a.overdue ||
      b.riskScore - a.riskScore ||
      b.fronts - a.fronts ||
      b.total - a.total ||
      a.nome.localeCompare(b.nome, "pt-BR")
    );

  const projetosMap = new Map();

  tasks.forEach((task) => {
    const projeto = formatProjeto(task);

    if (!projetosMap.has(projeto)) {
      projetosMap.set(projeto, []);
    }

    projetosMap.get(projeto).push(task);
  });

  const projetos = [...projetosMap.entries()]
    .map(([nome, projetoTasks]) => {
      const overdueCount = projetoTasks.filter((task) => isTaskOverdue(task, today)).length;
      const highCount = projetoTasks.filter((task) => ["alta", "critica"].includes(task.prioridade)).length;
      const upcomingCount = projetoTasks.filter((task) => isTaskUpcoming(task, today, 7)).length;
      const responsaveis = countUniqueResponsaveis(projetoTasks);
      const riskScore = projetoTasks.reduce((sum, task) => sum + getTaskRiskScore(task, today), 0);

      return {
        nome,
        total: projetoTasks.length,
        overdue: overdueCount,
        high: highCount,
        upcoming: upcomingCount,
        responsaveis,
        riskScore
      };
    })
    .sort((a, b) =>
      b.overdue - a.overdue ||
      b.riskScore - a.riskScore ||
      b.high - a.high ||
      b.upcoming - a.upcoming ||
      b.total - a.total ||
      a.nome.localeCompare(b.nome, "pt-BR")
    );

  const responsaveisComConflito = responsaveis.filter((item) => item.hasConflict).length;

  return {
    totalTasks: tasks.length,
    overdue: overdue.length,
    highPriority: highPriority.length,
    upcoming: upcoming.length,
    responsaveisComConflito,
    responsaveis,
    projetos
  };
}

function getGestaoQuickActions(tasks) {
  const today = getTodayKey();

  const overdue = tasks
    .filter((task) => isTaskOverdue(task, today))
    .sort((a, b) => {
      const aScore = getTaskRiskScore(a, today);
      const bScore = getTaskRiskScore(b, today);
      return bScore - aScore;
    });

  const highPriority = tasks
    .filter((task) => ["alta", "critica"].includes(task.prioridade))
    .sort((a, b) => {
      const aScore = getTaskRiskScore(a, today);
      const bScore = getTaskRiskScore(b, today);
      return bScore - aScore;
    });

  const upcoming = tasks
    .filter((task) => isTaskUpcoming(task, today, 7))
    .sort((a, b) => {
      const ra = getDateRangeForTask(a);
      const rb = getDateRangeForTask(b);
      return ra.end - rb.end;
    });

  const unassigned = tasks
    .filter((task) => formatResponsavel(task) === "Sem responsável")
    .sort((a, b) => {
      const aScore = getTaskRiskScore(a, today);
      const bScore = getTaskRiskScore(b, today);
      return bScore - aScore;
    });

  return {
    overdue,
    highPriority,
    upcoming,
    unassigned
  };
}

function getFilterMeta(filterType, filterValue) {
  const map = {
    all: {
      title: "Todas as tarefas ativas",
      description: "Visão geral da operação atual."
    },
    overdue: {
      title: "Tarefas em atraso",
      description: "Itens vencidos que precisam de reação imediata."
    },
    high: {
      title: "Tarefas de alta prioridade",
      description: "Itens classificados como alta ou crítica."
    },
    upcoming: {
      title: "Tarefas com vencimento em 7 dias",
      description: "Curto prazo que já pede acompanhamento."
    },
    unassigned: {
      title: "Tarefas sem responsável",
      description: "Itens que ainda não têm dono definido."
    },
    responsavel: {
      title: `Responsável: ${filterValue || "—"}`,
      description: "Recorte operacional por responsável."
    },
    projeto: {
      title: `Projeto: ${filterValue || "—"}`,
      description: "Recorte operacional por projeto."
    }
  };

  return map[filterType] || map.all;
}

function applyGestaoFilter(tasks) {
  const today = getTodayKey();
  const { filterType, filterValue, sortMode } = gestaoUiState;

  let filtered = [...tasks];

  if (filterType === "overdue") {
    filtered = filtered.filter((task) => isTaskOverdue(task, today));
  }

  if (filterType === "high") {
    filtered = filtered.filter((task) => ["alta", "critica"].includes(task.prioridade));
  }

  if (filterType === "upcoming") {
    filtered = filtered.filter((task) => isTaskUpcoming(task, today, 7));
  }

  if (filterType === "unassigned") {
    filtered = filtered.filter((task) => formatResponsavel(task) === "Sem responsável");
  }

  if (filterType === "responsavel") {
    filtered = filtered.filter((task) => formatResponsavel(task) === filterValue);
  }

  if (filterType === "projeto") {
    filtered = filtered.filter((task) => formatProjeto(task) === filterValue);
  }

  filtered.sort((a, b) => {
    if (sortMode === "due") {
      const ra = getDateRangeForTask(a);
      const rb = getDateRangeForTask(b);
      const aEnd = ra ? ra.end.getTime() : Number.MAX_SAFE_INTEGER;
      const bEnd = rb ? rb.end.getTime() : Number.MAX_SAFE_INTEGER;
      return aEnd - bEnd || getTaskRiskScore(b, today) - getTaskRiskScore(a, today);
    }

    return getTaskRiskScore(b, today) - getTaskRiskScore(a, today);
  });

  return filtered;
}

function renderMetricCard(label, value, hint, tone = "") {
  return `
    <div class="cronograma-calendar-kpi ${tone ? `cronograma-calendar-kpi--${tone}` : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </div>
  `;
}

function renderResumoExecutivoCard(metrics) {
  return `
    <section class="cronograma-panel cronograma-gestao-summary-card">
      <div class="cronograma-section-head">
        <div>
          <h3>Resumo executivo</h3>
          <p>Indicadores centrais da operação atual, em leitura compacta.</p>
        </div>
      </div>

      <div class="cronograma-gestao-summary-grid">
        ${renderMetricCard("Tarefas ativas", String(metrics.totalTasks), "Base operacional atual")}
        ${renderMetricCard("Atrasadas", String(metrics.overdue), "Pendências vencidas", metrics.overdue ? "danger" : "")}
        ${renderMetricCard("Alta prioridade", String(metrics.highPriority), "Itens críticos")}
        ${renderMetricCard("Próx. 7 dias", String(metrics.upcoming), "Radar de curto prazo", metrics.upcoming ? "warning" : "")}
        ${renderMetricCard("Conflitos", String(metrics.responsaveisComConflito), "Responsáveis com frentes simultâneas", metrics.responsaveisComConflito ? "warning" : "")}
      </div>
    </section>
  `;
}

function renderResponsavelCard(item) {
  return `
    <button
      class="cronograma-gestao-card ${item.conflictLevel !== "none" ? `is-${item.conflictLevel}` : ""}"
      type="button"
      data-action="filter-responsavel"
      data-responsavel="${escapeHtml(item.nome)}"
    >
      <div class="cronograma-gestao-card__head">
        <h3>${escapeHtml(item.nome)}</h3>
        ${
          item.fronts > 1
            ? `<span class="cronograma-gestao-badge cronograma-gestao-badge--warning">${item.fronts} frentes</span>`
            : `<span class="cronograma-gestao-badge">${item.fronts} frente</span>`
        }
      </div>

      <div class="cronograma-gestao-card__metrics">
        <span><strong>${item.total}</strong> tarefas ativas</span>
        <span class="${item.overdue ? "is-danger" : ""}">
          <strong>${item.overdue}</strong> atrasadas
        </span>
        <span>
          <strong>${item.upcoming}</strong> próximas de vencer
        </span>
      </div>
    </button>
  `;
}

function renderProjetoCard(item) {
  return `
    <button
      class="cronograma-gestao-card"
      type="button"
      data-action="filter-projeto"
      data-projeto="${escapeHtml(item.nome)}"
    >
      <div class="cronograma-gestao-card__head">
        <h3>${escapeHtml(item.nome)}</h3>
        <span class="cronograma-gestao-badge">${item.total} tarefas</span>
      </div>

      <div class="cronograma-gestao-card__metrics">
        <span class="${item.overdue ? "is-danger" : ""}">
          <strong>${item.overdue}</strong> atrasadas
        </span>
        <span class="${item.high ? "is-warning" : ""}">
          <strong>${item.high}</strong> altas/críticas
        </span>
        <span>
          <strong>${item.upcoming}</strong> vencem em 7 dias
        </span>
        <span>
          <strong>${item.responsaveis}</strong> responsáveis
        </span>
      </div>
    </button>
  `;
}

function renderGestaoTaskCard(task) {
  const range = getDateRangeForTask(task);
  const dataFim = range ? range.end.toLocaleDateString("pt-BR") : "Sem data";
  const riskScore = getTaskRiskScore(task);
  const overdue = isTaskOverdue(task);

  return `
    <button
      class="cronograma-gestao-task-card ${overdue ? "is-overdue" : ""}"
      type="button"
      data-action="open-task"
      data-task-id="${escapeHtml(task.id || "")}"
    >
      <strong>${escapeHtml(task.titulo || "Tarefa")}</strong>
      <span>${escapeHtml(formatProjeto(task))}</span>
      <span>${escapeHtml(formatResponsavel(task))}</span>

      <div class="cronograma-gestao-task-card__meta">
        <span>${escapeHtml(formatPrioridade(task.prioridade))}</span>
        <span>${escapeHtml(formatStatus(task.status))}</span>
        <span>Vence: ${escapeHtml(dataFim)}</span>
        <span>Risco: ${escapeHtml(String(riskScore))}</span>
      </div>
    </button>
  `;
}

function renderGestaoBoardColumn(title, items, emptyText, tone = "", filterType = "all") {
  return `
    <section class="cronograma-gestao-board__column">
      <div class="cronograma-gestao-board__head">
        <div>
          <h3>${escapeHtml(title)}</h3>
        </div>

        <div class="cronograma-gestao-board__actions">
          <span class="cronograma-gestao-badge ${tone ? `cronograma-gestao-badge--${tone}` : ""}">
            ${items.length}
          </span>
          <button
            class="cronograma-link-button"
            type="button"
            data-action="set-filter"
            data-filter-type="${escapeHtml(filterType)}"
          >
            Ver tudo
          </button>
        </div>
      </div>

      <div class="cronograma-gestao-board__list">
        ${
          items.length
            ? items.slice(0, 6).map(renderGestaoTaskCard).join("")
            : `<div class="cronograma-empty-state cronograma-empty-state--compact">${escapeHtml(emptyText)}</div>`
        }
      </div>
    </section>
  `;
}

function renderGestaoFilterToolbar() {
  const filters = [
    { key: "all", label: "Todas" },
    { key: "overdue", label: "Atrasadas" },
    { key: "high", label: "Alta prioridade" },
    { key: "upcoming", label: "Próx. 7 dias" },
    { key: "unassigned", label: "Sem responsável" }
  ];

  return `
    <div class="cronograma-gestao-toolbar">
      <div class="cronograma-gestao-toolbar__chips">
        ${filters
          .map(
            (filter) => `
              <button
                class="cronograma-filter-chip ${gestaoUiState.filterType === filter.key ? "is-active" : ""}"
                type="button"
                data-action="set-filter"
                data-filter-type="${escapeHtml(filter.key)}"
              >
                ${escapeHtml(filter.label)}
              </button>
            `
          )
          .join("")}
      </div>

      <div class="cronograma-gestao-toolbar__sort">
        <label for="gestao-sort-mode">Ordenar por</label>
        <select id="gestao-sort-mode" data-action="change-sort">
          <option value="risk" ${gestaoUiState.sortMode === "risk" ? "selected" : ""}>Risco</option>
          <option value="due" ${gestaoUiState.sortMode === "due" ? "selected" : ""}>Prazo</option>
        </select>
      </div>
    </div>
  `;
}

function renderGestaoFilterPanel() {
  return `
    <section class="cronograma-panel">
      <div class="cronograma-section-head">
        <div>
          <h3>Filtros rápidos</h3>
          <p>Use os recortes abaixo para focar imediatamente no que exige ação.</p>
        </div>
      </div>

      ${renderGestaoFilterToolbar()}
    </section>
  `;
}

function renderFilteredResults(tasks) {
  const meta = getFilterMeta(gestaoUiState.filterType, gestaoUiState.filterValue);

  return `
    <section class="cronograma-panel">
      <div class="cronograma-section-head">
        <div>
          <h3>${escapeHtml(meta.title)}</h3>
          <p>${escapeHtml(meta.description)}</p>
        </div>

        <div class="cronograma-gestao-results__actions">
          <span class="cronograma-gestao-badge">${tasks.length} itens</span>
          ${
            gestaoUiState.filterType !== "all"
              ? `
                <button
                  class="cronograma-link-button"
                  type="button"
                  data-action="set-filter"
                  data-filter-type="all"
                >
                  Limpar filtro
                </button>
              `
              : ""
          }
        </div>
      </div>

      <div class="cronograma-gestao-results">
        ${
          tasks.length
            ? tasks.map(renderGestaoTaskCard).join("")
            : `<div class="cronograma-empty-state">Nenhuma tarefa encontrada para este recorte.</div>`
        }
      </div>
    </section>
  `;
}

function getGestaoTemplate() {
  const tasks = getFilteredGestaoTasks();
  const metrics = getGestaoMetrics(tasks);
  const quick = getGestaoQuickActions(tasks);
  const filteredTasks = applyGestaoFilter(tasks);

  return `
    <div class="cronograma-view-grid">
      <section class="cronograma-panel cronograma-gestao-shell">
        <div class="cronograma-section-head">
          <div>
            <h2>Gestão visual do cronograma</h2>
            <p>
              Visão consolidada de carga, risco e prioridades operacionais. Aqui o foco não é navegar no tempo,
              e sim enxergar onde a operação pede ação.
            </p>
          </div>
        </div>

        ${renderResumoExecutivoCard(metrics)}

        <section class="cronograma-panel">
          <div class="cronograma-section-head">
            <div>
              <h3>Carga por responsável</h3>
              <p>Leitura rápida de volume, atrasos e paralelismo por pessoa.</p>
            </div>
          </div>

          <div class="cronograma-gestao-responsaveis">
            ${
              metrics.responsaveis.length
                ? metrics.responsaveis.map(renderResponsavelCard).join("")
                : `<div class="cronograma-empty-state">Nenhuma tarefa ativa encontrada.</div>`
            }
          </div>
        </section>

        <section class="cronograma-panel">
          <div class="cronograma-section-head">
            <div>
              <h3>Quadro operacional</h3>
              <p>Triagem rápida das tarefas que mais pedem ação no curto prazo.</p>
            </div>
          </div>

          <div class="cronograma-gestao-board">
            ${renderGestaoBoardColumn("Em atraso", quick.overdue, "Nenhuma tarefa atrasada.", "danger", "overdue")}
            ${renderGestaoBoardColumn("Alta prioridade", quick.highPriority, "Nenhuma tarefa alta/crítica.", "warning", "high")}
            ${renderGestaoBoardColumn("Vence em 7 dias", quick.upcoming, "Nenhum vencimento próximo.", "", "upcoming")}
            ${renderGestaoBoardColumn("Sem responsável", quick.unassigned, "Todas as tarefas têm responsável.", "", "unassigned")}
          </div>
        </section>

        ${renderGestaoFilterPanel()}

        ${renderFilteredResults(filteredTasks)}
      </section>

      <aside class="cronograma-panel cronograma-radar-panel">
        <div class="cronograma-radar-panel__head">
          <h3>Projetos sob atenção</h3>
          <p>Projetos ordenados por atraso e criticidade para apoiar a priorização gerencial.</p>
        </div>

        <div class="cronograma-radar-stack">
          ${
            metrics.projetos.length
              ? metrics.projetos.slice(0, 10).map(renderProjetoCard).join("")
              : `<div class="cronograma-empty-state">Nenhum projeto ativo com tarefas no período.</div>`
          }
        </div>
      </aside>
    </div>
  `;
}

function ensureTarefasListener() {
  if (unsubscribeTarefas) return;

  unsubscribeTarefas = listenTarefas(
    (items) => {
      setTarefas(items);
      if (state.currentView === "gestao") {
        renderGestaoView();
      }
    },
    (error) => {
      console.error(error);
      setTarefas([]);
      if (state.currentView === "gestao") {
        renderGestaoView();
      }
    }
  );
}

function ensureUsersListener() {
  if (unsubscribeUsers) return;

  unsubscribeUsers = listenUsers(
    (items) => {
      setUsers(items);
      if (state.currentView === "gestao") {
        renderGestaoView();
      }
    },
    (error) => {
      console.error(error);
      setUsers([]);
      if (state.currentView === "gestao") {
        renderGestaoView();
      }
    }
  );
}

function ensureProjetosListener() {
  if (unsubscribeProjetos) return;

  unsubscribeProjetos = listenProjetos(
    (items) => {
      setProjetos(items);
      if (state.currentView === "gestao") {
        renderGestaoView();
      }
    },
    (error) => {
      console.error(error);
      setProjetos([]);
      if (state.currentView === "gestao") {
        renderGestaoView();
      }
    }
  );
}

function mountGestaoEvents() {
  const root = document.querySelector(".cronograma-view-grid");
  if (!root) return;

  root.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    const {
      action,
      taskId,
      filterType,
      responsavel,
      projeto
    } = actionEl.dataset;

    if (action === "open-task" && taskId) {
      import("./tarefas.js").then(({ openTarefaEditor }) => {
        openTarefaEditor(taskId, { scrollToTop: true });
      });
      return;
    }

    if (action === "set-filter") {
      gestaoUiState.filterType = filterType || "all";
      gestaoUiState.filterValue = "";
      renderGestaoView();
      return;
    }

    if (action === "filter-responsavel") {
      gestaoUiState.filterType = "responsavel";
      gestaoUiState.filterValue = responsavel || "";
      renderGestaoView();
      return;
    }

    if (action === "filter-projeto") {
      gestaoUiState.filterType = "projeto";
      gestaoUiState.filterValue = projeto || "";
      renderGestaoView();
    }
  });

  root.addEventListener("change", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    const { action } = actionEl.dataset;

    if (action === "change-sort") {
      gestaoUiState.sortMode = actionEl.value || "risk";
      renderGestaoView();
    }
  });
}

export function renderGestaoView() {
  ensureTarefasListener();
  ensureUsersListener();
  ensureProjetosListener();

  renderIntoApp(getGestaoTemplate());
  mountGestaoEvents();
}
