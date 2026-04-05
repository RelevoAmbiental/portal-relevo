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

const dashboardUiState = {
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

function getDashboardTasks() {
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

function getDashboardMetrics(tasks) {
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
    totalProjetosAtivos: projetos.length,
    overdue: overdue.length,
    highPriority: highPriority.length,
    upcoming: upcoming.length,
    responsaveisComConflito,
    responsaveis,
    projetos
  };
}

function getDashboardQuickData(tasks) {
  const today = getTodayKey();

  const overdue = tasks
    .filter((task) => isTaskOverdue(task, today))
    .sort((a, b) => getTaskRiskScore(b, today) - getTaskRiskScore(a, today));

  const highPriority = tasks
    .filter((task) => ["alta", "critica"].includes(task.prioridade))
    .sort((a, b) => getTaskRiskScore(b, today) - getTaskRiskScore(a, today));

  const upcoming = tasks
    .filter((task) => isTaskUpcoming(task, today, 7))
    .sort((a, b) => {
      const ra = getDateRangeForTask(a);
      const rb = getDateRangeForTask(b);
      return ra.end - rb.end;
    });

  const unassigned = tasks
    .filter((task) => formatResponsavel(task) === "Sem responsável")
    .sort((a, b) => getTaskRiskScore(b, today) - getTaskRiskScore(a, today));

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
      title: "Leitura geral da operação",
      description: "Visão consolidada das tarefas ativas no cronograma."
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
      description: "Entregas e marcos que exigem acompanhamento próximo."
    },
    unassigned: {
      title: "Tarefas sem responsável",
      description: "Itens que ainda não têm dono definido."
    },
    responsavel: {
      title: `Responsável: ${filterValue || "—"}`,
      description: "Recorte executivo por responsável."
    },
    projeto: {
      title: `Projeto: ${filterValue || "—"}`,
      description: "Recorte executivo por projeto."
    }
  };

  return map[filterType] || map.all;
}

function applyDashboardFilter(tasks) {
  const today = getTodayKey();
  const { filterType, filterValue, sortMode } = dashboardUiState;

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

function renderTaskCard(task) {
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

function renderDashboardTopCard(metrics) {
  return `
    <section class="cronograma-panel cronograma-dashboard-top-card">
      <div class="cronograma-section-head">
        <div>
          <p class="cronograma-section-head__eyebrow">Leitura executiva</p>
          <h2>Dashboard do cronograma</h2>
          <p>
            Painel de entrada da aplicação com indicadores, gargalos e resumos da operação atual.
          </p>
        </div>
      </div>

      <div class="cronograma-gestao-summary-grid">
        ${renderMetricCard("Projetos ativos", String(metrics.totalProjetosAtivos), "Frentes em operação")}
        ${renderMetricCard("Tarefas ativas", String(metrics.totalTasks), "Base operacional aberta")}
        ${renderMetricCard("Atrasadas", String(metrics.overdue), "Pendências vencidas", metrics.overdue ? "danger" : "")}
        ${renderMetricCard("Alta prioridade", String(metrics.highPriority), "Itens críticos")}
        ${renderMetricCard("Próx. 7 dias", String(metrics.upcoming), "Radar de curto prazo", metrics.upcoming ? "warning" : "")}
      </div>

      <div class="cronograma-dashboard-top-card__filters">
        <div class="cronograma-section-head">
          <div>
            <h3>Filtros executivos</h3>
            <p>Use os recortes abaixo para navegar nos principais resumos da operação.</p>
          </div>
        </div>

        ${renderDashboardFilterToolbar()}
      </div>
    </section>
  `;
}

function renderDashboardFilterToolbar() {
  const filters = [
    { key: "all", label: "Visão geral" },
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
                class="cronograma-filter-chip ${dashboardUiState.filterType === filter.key ? "is-active" : ""}"
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
        <label for="dashboard-sort-mode">Ordenar por</label>
        <select id="dashboard-sort-mode" data-action="change-sort">
          <option value="risk" ${dashboardUiState.sortMode === "risk" ? "selected" : ""}>Risco</option>
          <option value="due" ${dashboardUiState.sortMode === "due" ? "selected" : ""}>Prazo</option>
        </select>
      </div>
    </div>
  `;
}

function renderDashboardQuickPanel(quick) {
  return `
    <section class="cronograma-panel">
      <div class="cronograma-section-head">
        <div>
          <h3>Radar de curto prazo</h3>
          <p>Leitura rápida das tarefas que mais pedem atenção agora.</p>
        </div>
      </div>

      <div class="cronograma-mini-list">
        <div class="cronograma-mini-list__group">
          <div class="cronograma-mini-list__group-head">
            <strong>Entregas da semana</strong>
            <button class="cronograma-link-button" type="button" data-action="set-filter" data-filter-type="upcoming">
              Abrir lista
            </button>
          </div>

          ${
            quick.upcoming.length
              ? quick.upcoming.slice(0, 4).map((task) => `
                <div class="cronograma-mini-list__item">
                  <strong>${escapeHtml(task.titulo || "Tarefa")}</strong>
                  <span>${escapeHtml(formatProjeto(task))}</span>
                  <span>${escapeHtml(formatResponsavel(task))}</span>
                </div>
              `).join("")
              : `<div class="cronograma-empty-state cronograma-empty-state--compact">Nenhuma entrega prevista para os próximos 7 dias.</div>`
          }
        </div>

        <div class="cronograma-mini-list__group">
          <div class="cronograma-mini-list__group-head">
            <strong>Pendências críticas</strong>
            <button class="cronograma-link-button" type="button" data-action="set-filter" data-filter-type="high">
              Abrir lista
            </button>
          </div>

          ${
            quick.highPriority.length
              ? quick.highPriority.slice(0, 4).map((task) => `
                <div class="cronograma-mini-list__item">
                  <strong>${escapeHtml(task.titulo || "Tarefa")}</strong>
                  <span>${escapeHtml(formatProjeto(task))}</span>
                  <span>${escapeHtml(formatResponsavel(task))}</span>
                </div>
              `).join("")
              : `<div class="cronograma-empty-state cronograma-empty-state--compact">Nenhuma tarefa alta ou crítica neste momento.</div>`
          }
        </div>
      </div>
    </section>
  `;
}

function renderFilteredResults(tasks) {
  const meta = getFilterMeta(dashboardUiState.filterType, dashboardUiState.filterValue);

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
            dashboardUiState.filterType !== "all"
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
            ? tasks.slice(0, 12).map(renderTaskCard).join("")
            : `<div class="cronograma-empty-state">Nenhuma tarefa encontrada para este recorte.</div>`
        }
      </div>
    </section>
  `;
}

function getDashboardTemplate() {
  const tasks = getDashboardTasks();
  const metrics = getDashboardMetrics(tasks);
  const quick = getDashboardQuickData(tasks);
  const filteredTasks = applyDashboardFilter(tasks);

  return `
    <div class="cronograma-dashboard-layout">
      ${renderDashboardTopCard(metrics)}

      <div class="cronograma-view-grid">
        <section class="cronograma-panel cronograma-gestao-shell">
          <section class="cronograma-panel">
            <div class="cronograma-section-head">
              <div>
                <h3>Projetos sob atenção</h3>
                <p>Projetos ordenados por atraso, criticidade e pressão operacional.</p>
              </div>
            </div>

            <div class="cronograma-gestao-projetos">
              ${
                metrics.projetos.length
                  ? metrics.projetos.slice(0, 6).map(renderProjetoCard).join("")
                  : `<div class="cronograma-empty-state">Nenhum projeto ativo com tarefas no período.</div>`
              }
            </div>
          </section>

          <section class="cronograma-panel">
            <div class="cronograma-section-head">
              <div>
                <h3>Carga por responsável</h3>
                <p>Leitura executiva de volume, atrasos e paralelismo por pessoa.</p>
              </div>
            </div>

            <div class="cronograma-gestao-responsaveis">
              ${
                metrics.responsaveis.length
                  ? metrics.responsaveis.slice(0, 6).map(renderResponsavelCard).join("")
                  : `<div class="cronograma-empty-state">Nenhuma tarefa ativa encontrada.</div>`
              }
            </div>
          </section>

          ${renderFilteredResults(filteredTasks)}
        </section>

        <aside class="cronograma-panel cronograma-dashboard-sidebar">
          ${renderDashboardQuickPanel(quick)}

          <section class="cronograma-panel">
            <div class="cronograma-section-head">
              <div>
                <h3>Alertas de operação</h3>
                <p>Leituras curtas para apoiar priorização rápida.</p>
              </div>
            </div>

            <div class="cronograma-mini-list">
              <div class="cronograma-mini-list__item">
                <strong>${escapeHtml(String(metrics.overdue))} tarefas atrasadas</strong>
                <span>Pendências vencidas que já impactam a fluidez da execução.</span>
              </div>

              <div class="cronograma-mini-list__item">
                <strong>${escapeHtml(String(metrics.responsaveisComConflito))} responsáveis com conflito</strong>
                <span>Indício de paralelismo alto ou sobrecarga de frente.</span>
              </div>

              <div class="cronograma-mini-list__item">
                <strong>${escapeHtml(String(quick.unassigned.length))} tarefas sem responsável</strong>
                <span>Itens ainda sem alocação clara de execução.</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;
}

function ensureTarefasListener() {
  if (unsubscribeTarefas) return;

  unsubscribeTarefas = listenTarefas(
    (items) => {
      setTarefas(items);
      if (state.currentView === "dashboard") {
        renderDashboardView();
      }
    },
    (error) => {
      console.error(error);
      setTarefas([]);
      if (state.currentView === "dashboard") {
        renderDashboardView();
      }
    }
  );
}

function ensureUsersListener() {
  if (unsubscribeUsers) return;

  unsubscribeUsers = listenUsers(
    (items) => {
      setUsers(items);
      if (state.currentView === "dashboard") {
        renderDashboardView();
      }
    },
    (error) => {
      console.error(error);
      setUsers([]);
      if (state.currentView === "dashboard") {
        renderDashboardView();
      }
    }
  );
}

function ensureProjetosListener() {
  if (unsubscribeProjetos) return;

  unsubscribeProjetos = listenProjetos(
    (items) => {
      setProjetos(items);
      if (state.currentView === "dashboard") {
        renderDashboardView();
      }
    },
    (error) => {
      console.error(error);
      setProjetos([]);
      if (state.currentView === "dashboard") {
        renderDashboardView();
      }
    }
  );
}

function mountDashboardEvents() {
  const root = document.querySelector(".cronograma-dashboard-layout");
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
      dashboardUiState.filterType = filterType || "all";
      dashboardUiState.filterValue = "";
      renderDashboardView();
      return;
    }

    if (action === "filter-responsavel") {
      dashboardUiState.filterType = "responsavel";
      dashboardUiState.filterValue = responsavel || "";
      renderDashboardView();
      return;
    }

    if (action === "filter-projeto") {
      dashboardUiState.filterType = "projeto";
      dashboardUiState.filterValue = projeto || "";
      renderDashboardView();
    }
  });

  root.addEventListener("change", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    const { action } = actionEl.dataset;

    if (action === "change-sort") {
      dashboardUiState.sortMode = actionEl.value || "risk";
      renderDashboardView();
    }
  });
}

export function renderDashboardView() {
  ensureTarefasListener();
  ensureUsersListener();
  ensureProjetosListener();

  renderIntoApp(getDashboardTemplate());
  mountDashboardEvents();
}
