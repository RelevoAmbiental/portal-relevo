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
  sortCalendarTasks
} from "../core/calendar-utils.js";

let unsubscribeTarefas = null;
let unsubscribeUsers = null;
let unsubscribeProjetos = null;

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

      return {
        nome,
        total: responsavelTasks.length,
        overdue: responsavelTasks.filter((task) => isTaskOverdue(task, today)).length,
        upcoming: responsavelTasks.filter((task) => isTaskUpcoming(task, today, 7)).length,
        fronts: stats.concurrentFronts,
        hasConflict: stats.hasConflict,
        conflictLevel: stats.conflictLevel
      };
    })
    .sort((a, b) =>
      b.overdue - a.overdue ||
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

      return {
        nome,
        total: projetoTasks.length,
        overdue: overdueCount,
        high: highCount,
        upcoming: upcomingCount,
        responsaveis
      };
    })
    .sort((a, b) =>
      b.overdue - a.overdue ||
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
    <article class="cronograma-gestao-card ${item.conflictLevel !== "none" ? `is-${item.conflictLevel}` : ""}">
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
    </article>
  `;
}

function renderProjetoCard(item) {
  return `
    <article class="cronograma-gestao-card">
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
    </article>
  `;
}

function getGestaoTemplate() {
  const tasks = getFilteredGestaoTasks();
  const metrics = getGestaoMetrics(tasks);

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

        <section class="cronograma-calendar-kpis">
          ${renderMetricCard("Tarefas ativas", String(metrics.totalTasks), "Base operacional atual")}
          ${renderMetricCard("Atrasadas", String(metrics.overdue), "Pendências vencidas", metrics.overdue ? "danger" : "")}
          ${renderMetricCard("Alta prioridade", String(metrics.highPriority), "Itens críticos")}
          ${renderMetricCard("Próx. 7 dias", String(metrics.upcoming), "Radar de curto prazo", metrics.upcoming ? "warning" : "")}
          ${renderMetricCard("Conflitos", String(metrics.responsaveisComConflito), "Responsáveis com frentes simultâneas", metrics.responsaveisComConflito ? "warning" : "")}
        </section>

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
              <h3>Projetos sob atenção</h3>
              <p>Ordenados por atraso e criticidade, para apoiar priorização gerencial.</p>
            </div>
          </div>

          <div class="cronograma-gestao-projetos">
            ${
              metrics.projetos.length
                ? metrics.projetos.slice(0, 10).map(renderProjetoCard).join("")
                : `<div class="cronograma-empty-state">Nenhum projeto ativo com tarefas no período.</div>`
            }
          </div>
        </section>
      </section>

      <aside class="cronograma-panel">
        <h3>Leitura executiva</h3>
        <div class="cronograma-mini-list">
          <div class="cronograma-mini-list__item">
            <strong>Agora</strong>
            <span>Identifique responsáveis sobrecarregados e projetos com atraso acumulado.</span>
          </div>
          <div class="cronograma-mini-list__item">
            <strong>Próxima etapa</strong>
            <span>Quadro operacional de ação rápida, com recortes por atraso, prioridade e vencimento.</span>
          </div>
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

export function renderGestaoView() {
  ensureTarefasListener();
  ensureUsersListener();
  ensureProjetosListener();

  renderIntoApp(getGestaoTemplate());
}
