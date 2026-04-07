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

function getGestaoTasks() {
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

function getResponsavelPressureMeta(item) {
  const volumeScore =
    item.total >= 8 ? 4 :
    item.total >= 6 ? 3 :
    item.total >= 4 ? 2 :
    item.total >= 2 ? 1 : 0;

  const urgencyScore =
    (item.overdue * 4) +
    (item.high * 3) +
    (item.upcoming * 2);

  const conflictScore =
    item.fronts >= 4 ? 5 :
    item.fronts === 3 ? 4 :
    item.fronts === 2 ? 2 : 0;

  const pressureScore = volumeScore + urgencyScore + conflictScore;

  let tone = "stable";
  let label = "Estável";
  let dominant = "volume";

  const dominantScore = Math.max(volumeScore, urgencyScore, conflictScore);

  if (dominantScore === urgencyScore) dominant = "urgencia";
  else if (dominantScore === conflictScore) dominant = "conflito";

  if (pressureScore >= 14) {
    tone = "critical";
    label = "Pressionado";
  } else if (pressureScore >= 7) {
    tone = "warning";
    label = "Atenção";
  }

  return {
    tone,
    label,
    dominant,
    pressureScore
  };
}

function getResponsavelDominantLabel(meta, item) {
  if (meta.dominant === "urgencia") {
    if (item.overdue > 0) return "Urgência alta";
    if (item.upcoming > 0) return "Prazo pressionado";
    return "Execução sensível";
  }

  if (meta.dominant === "conflito") {
    return item.fronts > 1 ? `${item.fronts} frentes paralelas` : "Sem conflito";
  }

  if (item.total >= 6) return "Volume alto";
  if (item.total >= 4) return "Volume moderado";
  return "Carga controlada";
}

function getProjectPressureMeta(project) {
  const pressureScore =
    (project.overdue * 4) +
    (project.high * 3) +
    (project.upcoming * 2) +
    (project.total >= 6 ? 1 : 0);

  if (pressureScore >= 8) {
    return {
      tone: "critical",
      label: "Crítico",
      score: pressureScore
    };
  }

  if (pressureScore >= 3) {
    return {
      tone: "warning",
      label: "Atenção",
      score: pressureScore
    };
  }

  return {
    tone: "stable",
    label: "Estável",
    score: pressureScore
  };
}

function getGestaoMetrics(tasks) {
  const today = getTodayKey();

  const overdue = tasks.filter((task) => isTaskOverdue(task, today));
  const highPriority = tasks.filter((task) => ["alta", "critica"].includes(task.prioridade));
  const upcoming = tasks.filter((task) => isTaskUpcoming(task, today, 7));
  const unassigned = tasks.filter((task) => formatResponsavel(task) === "Sem responsável");

  const aFazer = tasks.filter((task) => task.status === "a_fazer");
  const andamento = tasks.filter((task) => task.status === "andamento");
  const acompanhando = tasks.filter((task) => task.status === "acompanhando");

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
      const overdueCount = responsavelTasks.filter((task) => isTaskOverdue(task, today)).length;
      const upcomingCount = responsavelTasks.filter((task) => isTaskUpcoming(task, today, 7)).length;
      const highCount = responsavelTasks.filter((task) => ["alta", "critica"].includes(task.prioridade)).length;
      const riskScore = responsavelTasks.reduce((sum, task) => sum + getTaskRiskScore(task, today), 0);

      const baseItem = {
        nome,
        total: responsavelTasks.length,
        overdue: overdueCount,
        high: highCount,
        upcoming: upcomingCount,
        fronts: stats.concurrentFronts,
        hasConflict: stats.hasConflict,
        conflictLevel: stats.conflictLevel,
        riskScore
      };

      const pressure = getResponsavelPressureMeta(baseItem);

      return {
        ...baseItem,
        pressureTone: pressure.tone,
        pressureLabel: pressure.label,
        pressureScore: pressure.pressureScore,
        dominantLabel: getResponsavelDominantLabel(pressure, baseItem)
      };
    })
    .sort((a, b) =>
      b.pressureScore - a.pressureScore ||
      b.overdue - a.overdue ||
      b.high - a.high ||
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
      const pressure = getProjectPressureMeta({
        total: projetoTasks.length,
        overdue: overdueCount,
        high: highCount,
        upcoming: upcomingCount
      });

      return {
        nome,
        total: projetoTasks.length,
        overdue: overdueCount,
        high: highCount,
        upcoming: upcomingCount,
        responsaveis,
        riskScore,
        pressureTone: pressure.tone,
        pressureLabel: pressure.label,
        pressureScore: pressure.score
      };
    })
    .sort((a, b) =>
      b.pressureScore - a.pressureScore ||
      b.overdue - a.overdue ||
      b.riskScore - a.riskScore ||
      b.high - a.high ||
      b.total - a.total ||
      a.nome.localeCompare(b.nome, "pt-BR")
    );

  return {
    totalTasks: tasks.length,
    totalProjetos: projetos.length,
    overdue: overdue.length,
    highPriority: highPriority.length,
    upcoming: upcoming.length,
    unassigned: unassigned.length,
    aFazer: aFazer.length,
    andamento: andamento.length,
    acompanhando: acompanhando.length,
    responsaveisComConflito: responsaveis.filter((item) => item.hasConflict).length,
    responsaveisPressionados: responsaveis.filter((item) => item.pressureTone === "critical").length,
    responsaveis,
    projetos
  };
}

function getGestaoOperationalData(tasks) {
  const today = getTodayKey();

  const topRisks = [...tasks]
    .sort((a, b) => getTaskRiskScore(b, today) - getTaskRiskScore(a, today))
    .slice(0, 8);

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

  const byStatus = {
    a_fazer: tasks
      .filter((task) => task.status === "a_fazer")
      .sort((a, b) => getTaskRiskScore(b, today) - getTaskRiskScore(a, today)),
    andamento: tasks
      .filter((task) => task.status === "andamento")
      .sort((a, b) => getTaskRiskScore(b, today) - getTaskRiskScore(a, today)),
    acompanhando: tasks
      .filter((task) => task.status === "acompanhando")
      .sort((a, b) => getTaskRiskScore(b, today) - getTaskRiskScore(a, today))
  };

  return {
    topRisks,
    overdue,
    highPriority,
    upcoming,
    unassigned,
    byStatus
  };
}

function buildSwotMatrix(metrics, operational) {
  const strengths = [];
  const weaknesses = [];
  const opportunities = [];
  const threats = [];

  if (metrics.overdue === 0) {
    strengths.push({
      title: "Sem atrasos abertos",
      description: "O cronograma ativo não apresenta pendências vencidas neste momento."
    });
  } else if (metrics.overdue <= 2) {
    strengths.push({
      title: "Atraso ainda contido",
      description: "O volume de pendências vencidas ainda está em patamar recuperável."
    });
  }

  if (metrics.unassigned === 0) {
    strengths.push({
      title: "Responsabilidades definidas",
      description: "Todas as tarefas ativas têm responsável atribuído."
    });
  }

  if (metrics.responsaveisComConflito === 0) {
    strengths.push({
      title: "Baixo conflito de frentes",
      description: "A equipe não apresenta sobreposição relevante de execução."
    });
  }

  if (metrics.overdue > 0) {
    weaknesses.push({
      title: `${metrics.overdue} tarefa${metrics.overdue === 1 ? "" : "s"} atrasada${metrics.overdue === 1 ? "" : "s"}`,
      description: "Há pendências vencidas que já exigem reação de gestão."
    });
  }

  if (metrics.unassigned > 0) {
    weaknesses.push({
      title: `${metrics.unassigned} item${metrics.unassigned === 1 ? "" : "s"} sem responsável`,
      description: "Existem entregas sem dono claro, o que dilui accountability."
    });
  }

  if (metrics.responsaveisComConflito > 0) {
    weaknesses.push({
      title: `${metrics.responsaveisComConflito} responsável${metrics.responsaveisComConflito === 1 ? "" : "is"} com conflito`,
      description: "Há paralelismo operacional que pode reduzir previsibilidade."
    });
  }

  if (metrics.upcoming > 0) {
    opportunities.push({
      title: "Janela para alinhamento semanal",
      description: `${metrics.upcoming} entrega${metrics.upcoming === 1 ? "" : "s"} entram no radar de 7 dias e podem ser antecipadas com ajuste fino.`
    });
  }

  const pressuredResponsavel = metrics.responsaveis[0];
  if (pressuredResponsavel) {
    opportunities.push({
      title: "Redistribuição de carga",
      description: `A leitura de pressão sugere revisão de foco para ${pressuredResponsavel.nome}.`
    });
  }

  const criticalProject = metrics.projetos.find((item) => item.pressureTone === "critical");
  if (criticalProject) {
    opportunities.push({
      title: "Ataque concentrado por projeto",
      description: `O projeto ${criticalProject.nome} concentra pressão e pode ganhar um plano tático curto.`
    });
  }

  if (metrics.highPriority > 0 && metrics.overdue > 0) {
    threats.push({
      title: "Críticos com risco de escalada",
      description: "A combinação de atraso e alta prioridade pode contaminar marcos importantes."
    });
  }

  if (metrics.responsaveisPressionados > 0) {
    threats.push({
      title: "Sobrecarga humana",
      description: `${metrics.responsaveisPressionados} responsável${metrics.responsaveisPressionados === 1 ? "" : "is"} já opera${metrics.responsaveisPressionados === 1 ? "" : "m"} sob pressão alta.`
    });
  }

  if (operational.unassigned.length > 0) {
    threats.push({
      title: "Risco de tarefa órfã",
      description: "Itens sem alocação tendem a escapar do fluxo e gerar atraso silencioso."
    });
  }

  if (!strengths.length) {
    strengths.push({
      title: "Base operacional ativa",
      description: "Há frente de trabalho em curso e base suficiente para gestão proativa."
    });
  }

  if (!weaknesses.length) {
    weaknesses.push({
      title: "Sem fraqueza crítica evidente",
      description: "Não há um gargalo dominante aparente no recorte atual."
    });
  }

  if (!opportunities.length) {
    opportunities.push({
      title: "Rotina de cadência",
      description: "Há espaço para fortalecer rituais curtos de acompanhamento e alinhamento."
    });
  }

  if (!threats.length) {
    threats.push({
      title: "Risco controlado",
      description: "No momento, não há ameaça operacional dominante no recorte."
    });
  }

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    opportunities: opportunities.slice(0, 3),
    threats: threats.slice(0, 3)
  };
}

function getFilterMeta(filterType, filterValue) {
  const map = {
    all: {
      title: "Fila de intervenção",
      description: "Recorte operacional consolidado das tarefas ativas."
    },
    overdue: {
      title: "Tarefas em atraso",
      description: "Pendências vencidas que precisam de reação imediata."
    },
    high: {
      title: "Tarefas de alta prioridade",
      description: "Itens classificados como alta ou crítica."
    },
    upcoming: {
      title: "Tarefas com vencimento em 7 dias",
      description: "Curto prazo que pede acompanhamento mais próximo."
    },
    unassigned: {
      title: "Tarefas sem responsável",
      description: "Itens sem definição clara de dono."
    },
    responsavel: {
      title: `Responsável: ${filterValue || "—"}`,
      description: "Recorte operacional por responsável."
    },
    projeto: {
      title: `Projeto: ${filterValue || "—"}`,
      description: "Recorte operacional por projeto."
    },
    status: {
      title: `Status: ${formatStatus(filterValue)}`,
      description: "Recorte operacional por etapa do fluxo."
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

  if (filterType === "status") {
    filtered = filtered.filter((task) => task.status === filterValue);
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
    <section class="cronograma-gestao-summary-compact">
      ${renderMetricCard("Atrasadas", metrics.overdue, "", metrics.overdue ? "danger" : "")}
      ${renderMetricCard("Alta", metrics.highPriority, "")}
      ${renderMetricCard("Sem resp.", metrics.unassigned, "", metrics.unassigned ? "warning" : "")}
      ${renderMetricCard("Execução", metrics.andamento, "")}
      ${renderMetricCard("Conflitos", metrics.responsaveisComConflito, "", metrics.responsaveisComConflito ? "warning" : "")}
    </section>
  `;
}

function renderGestaoFilterToolbar() {
  const filters = [
    { key: "all", label: "Fila geral" },
    { key: "overdue", label: "Atrasadas" },
    { key: "high", label: "Alta prioridade" },
    { key: "upcoming", label: "Próx. 7 dias" },
    { key: "unassigned", label: "Sem responsável" }
  ];

  return `
    <div class="cronograma-gestao-toolbar">
      <div class="cronograma-gestao-toolbar__chips">
        ${filters.map((filter) => `
          <button
            class="cronograma-filter-chip ${gestaoUiState.filterType === filter.key ? "is-active" : ""}"
            type="button"
            data-action="set-filter"
            data-filter-type="${escapeHtml(filter.key)}"
          >
            ${escapeHtml(filter.label)}
          </button>
        `).join("")}
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
          <h3>Ferramentas de foco</h3>
          <p>Use os filtros para atacar rapidamente o recorte que pede ação.</p>
        </div>
      </div>

      ${renderGestaoFilterToolbar()}
    </section>
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

function renderKanbanColumn(statusKey, title, items, emptyText, tone = "") {
  return `
    <section class="cronograma-kanban-column">
      <div class="cronograma-kanban-column__head">
        <h3>${escapeHtml(title)}</h3>

        <div class="cronograma-kanban-column__meta">
          <span class="cronograma-gestao-badge ${tone ? `cronograma-gestao-badge--${tone}` : ""}">
            ${items.length}
          </span>

          <button
            class="cronograma-link-button"
            type="button"
            data-action="set-status-filter"
            data-status="${escapeHtml(statusKey)}"
          >
            Ver
          </button>
        </div>
      </div>

      <div class="cronograma-kanban-column__list">
        ${
          items.length
            ? items.slice(0, 5).map(renderGestaoTaskCard).join("")
            : `<div class="cronograma-empty-state cronograma-empty-state--compact">${escapeHtml(emptyText)}</div>`
        }
      </div>
    </section>
  `;
}

function renderSwotGroup(title, items) {
  return `
    <section class="cronograma-gestao-board__column">
      <div class="cronograma-gestao-board__head">
        <div>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>

      <div class="cronograma-mini-list">
        ${items.map((item) => `
          <div class="cronograma-mini-list__item">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.description)}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSwotPanel(swot) {
  return `
    <section class="cronograma-panel">
      <div class="cronograma-section-head">
        <div>
          <h3>Matriz SWOT operacional</h3>
          <p>Leitura estratégica automática para apoiar decisões curtas de gestão.</p>
        </div>
      </div>

      <div class="cronograma-gestao-board">
        ${renderSwotGroup("Forças", swot.strengths)}
        ${renderSwotGroup("Fraquezas", swot.weaknesses)}
        ${renderSwotGroup("Oportunidades", swot.opportunities)}
        ${renderSwotGroup("Ameaças", swot.threats)}
      </div>
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
            ? tasks.slice(0, 18).map(renderGestaoTaskCard).join("")
            : `<div class="cronograma-empty-state">Nenhuma tarefa encontrada para este recorte.</div>`
        }
      </div>
    </section>
  `;
}

function renderQuickActionPanel(operational) {
  const items = operational.topRisks.slice(0, 8);

  return `
    <section class="cronograma-panel">
      <div class="cronograma-section-head">
        <div>
          <h3>Fila tática de intervenção</h3>
        </div>
      </div>

      <div class="cronograma-gestao-results">
        ${
          items.length
            ? items.map(renderGestaoTaskCard).join("")
            : `<div class="cronograma-empty-state">Nenhum item crítico no momento.</div>`
        }
      </div>
    </section>
  `;
}

function renderKanbanPanel(operational) {
  return `
    <section class="cronograma-panel">
      <div class="cronograma-section-head">
        <div>
          <h3>Kanban gerencial</h3>
          <p>Visão operacional do fluxo por status, com foco em destravar execução.</p>
        </div>
      </div>

      <div class="cronograma-gestao-board">
        ${renderKanbanColumn("a_fazer", "A fazer", operational.byStatus.a_fazer, "Nenhuma tarefa nesta coluna.")}
        ${renderKanbanColumn("andamento", "Em andamento", operational.byStatus.andamento, "Nenhuma tarefa em andamento.", "warning")}
        ${renderKanbanColumn("acompanhando", "Acompanhando", operational.byStatus.acompanhando, "Nenhuma tarefa em acompanhamento.")}
      </div>
    </section>
  `;
}

function getGestaoTemplate() {
  const tasks = getGestaoTasks();
  const metrics = getGestaoMetrics(tasks);
  const operational = getGestaoOperationalData(tasks);
  const swot = buildSwotMatrix(metrics, operational);
  const filteredTasks = applyGestaoFilter(tasks);

  return `
    <div class="cronograma-view-grid cronograma-view-grid--single">
      <section class="cronograma-panel cronograma-gestao-shell">
        ${renderResumoExecutivoCard(metrics)}
        ${renderGestaoFilterPanel()}
        ${renderKanbanPanel(operational)}
        ${renderQuickActionPanel(operational)}
        ${renderSwotPanel(swot)}
        ${gestaoUiState.filterType !== "all" ? renderFilteredResults(filteredTasks) : ""}
      </section>
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
      projeto,
      status
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

    if (action === "set-status-filter") {
      gestaoUiState.filterType = "status";
      gestaoUiState.filterValue = status || "";
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
