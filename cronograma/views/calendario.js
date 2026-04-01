import { listenProjetos } from "../services/firestore-projetos.js";
import { renderIntoApp, updateActiveNav } from "../ui/layout.js";
import {
  state,
  setView,
  setProjetos,
  setTarefas,
  setUsers,
  setTarefaEditandoId,
  setCalendarioMesReferencia,
  setCalendarioDataSelecionada,
  setCalendarioModo,
  setCalendarioFiltroProjeto,
  setCalendarioFiltroResponsavel,
  setCalendarioFiltroFase,
  setCalendarioMostrarArquivadas
} from "../core/state.js";
import { listenTarefas } from "../services/firestore-tarefas.js";
import { listenUsers } from "../services/firestore-users.js";
import { openTarefaEditor, renderTarefaEditorInContainer } from "./tarefas.js";
import {
  buildDayIndex,
  buildMonthMatrix,
  countUniqueResponsaveis,
  getDateRangeForTask,
  getMonthAnchor,
  getMonthLabel,
  getMonthRange,
  getTaskDurationDays,
  getTodayKey,
  getWeekdayLabels,
  groupTasksByProjeto,
  isTaskOverdue,
  isTaskUpcoming,
  parseDateKey,
  shiftMonth,
  sortCalendarTasks,
  taskIntersectsDate,
  toDateKey
} from "../core/calendar-utils.js";

let unsubscribeTarefas = null;
let unsubscribeUsers = null;
let unsubscribeProjetos = null;

const FASE_META = {
  planejamento: { label: "Planejamento", tone: "planejamento" },
  campo: { label: "Campo", tone: "campo" },
  gabinete: { label: "Gabinete", tone: "gabinete" },
  entrega: { label: "Entrega", tone: "entrega" },
  administrativo: { label: "Administrativo", tone: "administrativo" }
};

const PRIORIDADE_META = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica"
};

const STATUS_META = {
  a_fazer: "A fazer",
  andamento: "Em andamento",
  acompanhando: "Acompanhando",
  concluida: "Concluída"
};

const CALENDAR_VIEW_OPTIONS = [
  { value: "month", label: "Mensal", enabled: true },
  { value: "week", label: "Semanal", enabled: true },
  { value: "day", label: "Diária", enabled: true },
  { value: "timeline", label: "Linha do tempo", enabled: true }
];

const TIMELINE_RANGE_OPTIONS = [15, 30, 45];
let timelineRangeDays = 15;

function ensureProjetosListener() {
  if (unsubscribeProjetos) return;

  unsubscribeProjetos = listenProjetos(
    (items) => {
      setProjetos(items);
      if (state.currentView === "calendario") renderCalendarioView();
    },
    (error) => {
      console.error(error);
      setProjetos([]);
    }
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  const date = parseDateKey(value);
  if (!date) return "Sem data";
  return date.toLocaleDateString("pt-BR");
}

function formatDateLong(value) {
  const date = parseDateKey(value);
  if (!date) return "Sem data";
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatResponsavel(task) {
  return (task.responsavel || "").trim() || "Sem responsável";
}

function formatProjeto(task) {
  return (task.projetoNome || "").trim() || "Sem projeto";
}

function formatFase(value) {
  return FASE_META[value]?.label || "Sem fase";
}

function formatPrioridade(value) {
  return PRIORIDADE_META[value] || "Sem prioridade";
}

function formatStatus(value) {
  return STATUS_META[value] || "Sem status";
}

function getProjetoOptions() {
  const map = new Map();

  state.tarefas.forEach((task) => {
    if (!task.projetoId && !task.projetoNome) return;
    const key = task.projetoId || task.projetoNome;
    if (!map.has(key)) {
      map.set(key, {
        value: key,
        label: task.projetoNome || task.projetoId || "Projeto"
      });
    }
  });

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function getResponsavelOptions() {
  const nomes = [
    ...state.users.map((item) => item.nome || item.email || "Usuário"),
    ...state.tarefas.map((item) => item.responsavel || "")
  ];

  return [...new Set(nomes.map((item) => String(item || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((nome) => ({ value: nome, label: nome }));
}

function getFaseOptions() {
  return Object.entries(FASE_META).map(([value, meta]) => ({ value, label: meta.label }));
}
function getFilteredTasks() {
  const projetosMap = new Map(
    (state.projetos || []).map((projeto) => [
      projeto.id || projeto.nome,
      projeto
    ])
  );

  return sortCalendarTasks(
    state.tarefas
      .filter((task) => {
        if (!state.calendarioMostrarArquivadas && task.arquivada) return false;

        if (state.calendarioFiltroProjeto !== "todos") {
          const projectKey = task.projetoId || task.projetoNome;
          if (projectKey !== state.calendarioFiltroProjeto) return false;
        }

        if (
          state.calendarioFiltroResponsavel !== "todos" &&
          formatResponsavel(task) !== state.calendarioFiltroResponsavel
        ) {
          return false;
        }

        if (
          state.calendarioFiltroFase !== "todos" &&
          task.fase !== state.calendarioFiltroFase
        ) return false;

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

function getCalendarMetrics(tasks, monthRange) {
  const todayKey = getTodayKey();
  const visibleInMonth = tasks.filter((task) => {
    const range = getDateRangeForTask(task);
    if (!range) return false;
    const taskStart = toDateKey(range.start);
    const taskEnd = toDateKey(range.end);
    return taskEnd >= monthRange.startKey && taskStart <= monthRange.endKey;
  });

  const overdue = visibleInMonth.filter((task) => isTaskOverdue(task, todayKey)).length;
  const upcoming = visibleInMonth.filter((task) => isTaskUpcoming(task, todayKey, 7)).length;
  const responsaveis = countUniqueResponsaveis(visibleInMonth);

  return { visibleInMonth, overdue, upcoming, responsaveis };
}

function getSelectedDateKey() {
  return state.calendarioDataSelecionada || getTodayKey();
}

function getWeekAnchor(dateKey) {
  const base = parseDateKey(dateKey) || parseDateKey(getTodayKey()) || new Date();
  const day = base.getDay(); // 0 = domingo, 1 = segunda...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  return monday;
}

function getWeekDays(dateKey) {
  const anchor = getWeekAnchor(dateKey);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + index);

    return {
      date,
      key: toDateKey(date),
      dayNumber: date.getDate(),
      weekdayLabel: date.toLocaleDateString("pt-BR", { weekday: "short" }),
      isToday: toDateKey(date) === getTodayKey()
    };
  });
}

function getWeekLabel(dateKey) {
  const days = getWeekDays(dateKey);
  const first = days[0].date;
  const last = days[6].date;

  const firstLabel = first.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short"
  });

  const lastLabel = last.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  return `${firstLabel} → ${lastLabel}`;
}

function shiftWeek(dateKey, offset) {
  const base = parseDateKey(dateKey) || parseDateKey(getTodayKey()) || new Date();
  const shifted = new Date(base);
  shifted.setDate(base.getDate() + (offset * 7));
  return toDateKey(shifted);
}

function getTimelineRange() {
  const today = parseDateKey(getSelectedDateKey()) || new Date();
  const totalDays = Number(timelineRangeDays) || 15;

  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + totalDays - 1);
  end.setHours(0, 0, 0, 0);

  return {
    start,
    end,
    startKey: toDateKey(start),
    endKey: toDateKey(end),
    totalDays
  };
}

function diffDays(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function shiftTimeline(dateKey, offsetDays) {
  const base = parseDateKey(dateKey) || parseDateKey(getTodayKey()) || new Date();
  const shifted = new Date(base);
  shifted.setDate(base.getDate() + offsetDays);
  shifted.setHours(0, 0, 0, 0);
  return toDateKey(shifted);
}

function renderSelectOptions(items, selectedValue) {
  return items
    .map(
      (item) => `<option value="${escapeHtml(item.value)}" ${item.value === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`
    )
    .join("");
}

function renderCalendarMetricCard(label, value, hint, tone = "") {
  return `
    <div class="cronograma-calendar-kpi ${tone ? `cronograma-calendar-kpi--${tone}` : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </div>
  `;
}

function renderTimelineRangeOptions(selectedValue) {
  return TIMELINE_RANGE_OPTIONS.map((value) => `
    <option value="${value}" ${Number(selectedValue) === Number(value) ? "selected" : ""}>
      ${value} dias
    </option>
  `).join("");
}

function getTimelineStepDays() {
  const days = Number(timelineRangeDays) || 15;

  if (days <= 15) return 3;
  if (days <= 30) return 10;
  return 15;
}

function renderViewSwitch() {
  return `
    <div class="cronograma-calendar-view-switch" aria-label="Escalas do calendário">
      ${CALENDAR_VIEW_OPTIONS.map((item) => {
        const isActive = state.calendarioModo === item.value;
        return `
          <button
            class="cronograma-calendar-view-chip ${isActive ? "is-active" : ""} ${!item.enabled ? "is-disabled" : ""}"
            type="button"
            data-action="set-calendar-mode"
            data-mode="${item.value}"
            ${item.enabled ? "" : 'title="Escala preparada para a etapa 2" disabled aria-disabled="true"'}
          >
            ${escapeHtml(item.label)}
            ${!item.enabled ? '<span class="cronograma-calendar-chip-badge">etapa 2</span>' : ""}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderEventPill(task, selectedDateKey) {
  const range = getDateRangeForTask(task);
  const startKey = range ? toDateKey(range.start) : "";
  const endKey = range ? toDateKey(range.end) : "";
  const startsToday = startKey === selectedDateKey;
  const endsToday = endKey === selectedDateKey;
  const phaseTone = FASE_META[task.fase]?.tone || "planejamento";

  const projetoCor =
    task.projetoCor ||
    task.corProjeto ||
    task.projeto?.cor ||
    task.projeto?.color ||
    "#cfd8d3";

  const markers = [
    startsToday ? '<span class="cronograma-calendar-pill__flag">Início</span>' : "",
    endsToday && startKey !== endKey ? '<span class="cronograma-calendar-pill__flag">Entrega</span>' : "",
    isTaskOverdue(task) ? '<span class="cronograma-calendar-pill__flag cronograma-calendar-pill__flag--danger">Atraso</span>' : ""
  ].filter(Boolean).join("");

  return `
    <button
      class="cronograma-calendar-pill cronograma-calendar-pill--${phaseTone}"
      type="button"
      data-action="open-day"
      data-date="${selectedDateKey}"
      title="${escapeHtml(task.titulo || "Tarefa")}"
      style="--project-accent: ${escapeHtml(projetoCor)};"
    >
      <span class="cronograma-calendar-pill__project-bar" aria-hidden="true"></span>
      <span class="cronograma-calendar-pill__title">${escapeHtml(task.titulo || "Tarefa")}</span>
      ${markers ? `<span class="cronograma-calendar-pill__meta">${markers}</span>` : ""}
    </button>
  `;
}

function renderDayCell(day, tasks, isSelected) {
  const visibleTasks = tasks.slice(0, 3);
  const hiddenCount = Math.max(0, tasks.length - visibleTasks.length);

  return `
    <article
      class="cronograma-calendar-day ${day.isCurrentMonth ? "" : "is-outside"} ${day.isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}"
      data-action="open-day"
      data-date="${day.key}"
      aria-pressed="${isSelected ? "true" : "false"}"
      role="button"
      tabindex="0"
    >
      <header class="cronograma-calendar-day__header">
        <span class="cronograma-calendar-day__number">${day.dayNumber}</span>
        ${tasks.length ? `<span class="cronograma-calendar-day__badge">${tasks.length}</span>` : ""}
      </header>

      <div class="cronograma-calendar-day__body">
        ${visibleTasks.map((task) => renderEventPill(task, day.key)).join("")}
        ${hiddenCount ? `<button type="button" class="cronograma-calendar-day__more" data-action="open-day" data-date="${day.key}">+${hiddenCount} mais</button>` : ""}
      </div>
    </article>
  `;
}

function getTasksForSelectedDate() {
  const selectedDateKey = getSelectedDateKey();
  return getFilteredTasks().filter((task) => taskIntersectsDate(task, selectedDateKey));
}

function renderDayTaskCard(task, selectedDateKey) {
  const range = getDateRangeForTask(task);
  const startKey = range ? toDateKey(range.start) : "";
  const endKey = range ? toDateKey(range.end) : "";
  const startsToday = startKey === selectedDateKey;
  const endsToday = endKey === selectedDateKey;
  const duration = getTaskDurationDays(task);
  const phaseTone = FASE_META[task.fase]?.tone || "planejamento";
  const projetoCor =
    task.projetoCor ||
    task.corProjeto ||
    task.projeto?.cor ||
    task.projeto?.color ||
    "#cfd8d3";

  return `
    <article
      class="cronograma-calendar-day-card cronograma-calendar-day-card--${phaseTone}"
      style="--project-accent: ${escapeHtml(projetoCor)};"
      data-action="open-task"
      data-task-id="${escapeHtml(task.id || "")}"
      role="button"
      tabindex="0"
      aria-label="Abrir tarefa ${escapeHtml(task.titulo || "Tarefa")}"
    >
      <span class="cronograma-calendar-day-card__project-bar" aria-hidden="true"></span>

      <div class="cronograma-calendar-day-card__head">
        <div>
          <h3>${escapeHtml(task.titulo || "Tarefa")}</h3>
          <p>${escapeHtml(formatProjeto(task))}</p>
        </div>
        <span class="cronograma-tag cronograma-tag--muted">
          ${duration} dia${duration > 1 ? "s" : ""}
        </span>
      </div>

      <div class="cronograma-tag-row cronograma-tag-row--tight">
        <span class="cronograma-tag">${escapeHtml(formatFase(task.fase))}</span>
        <span class="cronograma-tag cronograma-tag--info">${escapeHtml(formatPrioridade(task.prioridade))}</span>
        <span class="cronograma-tag cronograma-tag--muted">${escapeHtml(formatStatus(task.status))}</span>
        ${startsToday ? '<span class="cronograma-tag cronograma-tag--info">Início</span>' : ""}
        ${endsToday && startKey !== endKey ? '<span class="cronograma-tag cronograma-tag--warning">Entrega</span>' : ""}
        ${isTaskOverdue(task) ? '<span class="cronograma-tag cronograma-tag--danger">Atrasada</span>' : ""}
      </div>

      <div class="cronograma-calendar-day-card__meta">
        <span><strong>Responsável:</strong> ${escapeHtml(formatResponsavel(task))}</span>
        <span><strong>Janela:</strong> ${escapeHtml(formatDate(task.dataInicio))} → ${escapeHtml(formatDate(task.dataVencimento))}</span>
      </div>

      ${task.descricao ? `<p class="cronograma-calendar-day-card__desc">${escapeHtml(task.descricao)}</p>` : ""}
    </article>
  `;
}

function renderWeekTaskPill(task, dateKey) {
  const range = getDateRangeForTask(task);
  const startKey = range ? toDateKey(range.start) : "";
  const endKey = range ? toDateKey(range.end) : "";
  const phaseTone = FASE_META[task.fase]?.tone || "planejamento";
  const projetoCor =
    task.projetoCor ||
    task.corProjeto ||
    task.projeto?.cor ||
    task.projeto?.color ||
    "#cfd8d3";

  return `
    <button
      class="cronograma-calendar-week-pill cronograma-calendar-week-pill--${phaseTone}"
      type="button"
      data-action="open-task"
      data-task-id="${escapeHtml(task.id || "")}"
      style="--project-accent: ${escapeHtml(projetoCor)};"
      title="${escapeHtml(task.titulo || "Tarefa")}"
    >
      <span class="cronograma-calendar-week-pill__bar" aria-hidden="true"></span>
      <span class="cronograma-calendar-week-pill__title">${escapeHtml(task.titulo || "Tarefa")}</span>
      <span class="cronograma-calendar-week-pill__meta">
        ${startKey === dateKey ? '<span class="cronograma-tag cronograma-tag--info">Início</span>' : ""}
        ${endKey === dateKey ? '<span class="cronograma-tag cronograma-tag--warning">Entrega</span>' : ""}
        ${isTaskOverdue(task) ? '<span class="cronograma-tag cronograma-tag--danger">Atrasada</span>' : ""}
      </span>
    </button>
  `;
}

function renderWeekDayColumn(day, tasks) {
  const dateLabel = day.date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });

  return `
    <article class="cronograma-calendar-week-day ${day.isToday ? "is-today" : ""}">
      <button
        class="cronograma-calendar-week-day__head"
        type="button"
        data-action="open-day"
        data-date="${day.key}"
      >
        <span class="cronograma-calendar-week-day__weekday">${escapeHtml(day.weekdayLabel)}</span>
        <strong class="cronograma-calendar-week-day__date">${escapeHtml(dateLabel)}</strong>
        ${tasks.length ? `<span class="cronograma-calendar-week-day__badge">${tasks.length}</span>` : ""}
      </button>

      <div class="cronograma-calendar-week-day__body">
        ${
          tasks.length
            ? tasks.map((task) => renderWeekTaskPill(task, day.key)).join("")
            : `<div class="cronograma-calendar-week-day__empty">Sem tarefas</div>`
        }
      </div>
    </article>
  `;
}

function renderTimelineBar(task, timelineStart) {
  const range = getDateRangeForTask(task);
  if (!range) return "";

  const start = range.start;
  const end = range.end;

  const offset = diffDays(timelineStart, start);
  const duration = Math.max(1, diffDays(start, end) + 1);

  const left = offset * 60;
  const width = duration * 60;

  const projetoCor =
    task.projetoCor ||
    task.projeto?.cor ||
    "#cfd8d3";

  return `
    <div
      class="cronograma-timeline-bar"
      style="
        left: ${left}px;
        width: ${width}px;
        --project-accent: ${projetoCor};
      "
      title="${escapeHtml(task.titulo)}"
      data-action="open-task"
      data-task-id="${escapeHtml(task.id || "")}"
    >
      <span>${escapeHtml(task.titulo)}</span>
    </div>
  `;
}

function groupTasksForTimeline(tasks) {
  const groups = new Map();

  tasks.forEach((task) => {
    const key = task.projetoNome || "Sem projeto";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(task);
  });

  return [...groups.entries()];
}

function classifyDayTasks(tasks, selectedDateKey) {
  const today = selectedDateKey;

  const groups = {
    overdue: [],
    dueToday: [],
    startingToday: [],
    highPriority: [],
    others: []
  };

  tasks.forEach((task) => {
    const range = getDateRangeForTask(task);
    if (!range) return;

    const startKey = toDateKey(range.start);
    const endKey = toDateKey(range.end);

    if (isTaskOverdue(task)) {
      groups.overdue.push(task);
      return;
    }

    if (endKey === today) {
      groups.dueToday.push(task);
      return;
    }

    if (startKey === today) {
      groups.startingToday.push(task);
      return;
    }

    if (["alta", "critica"].includes(task.prioridade)) {
      groups.highPriority.push(task);
      return;
    }

    groups.others.push(task);
  });

  return groups;
}

function getCalendarioWeekTemplate() {
  const selectedDateKey = getSelectedDateKey();
  const weekDays = getWeekDays(selectedDateKey);
  const filteredTasks = getFilteredTasks();

  const tasksByDay = new Map(
    weekDays.map((day) => [
      day.key,
      filteredTasks.filter((task) => taskIntersectsDate(task, day.key))
    ])
  );

  const allWeekTasks = filteredTasks.filter((task) =>
    weekDays.some((day) => taskIntersectsDate(task, day.key))
  );

  const previousWeekDate = shiftWeek(selectedDateKey, -1);
  const nextWeekDate = shiftWeek(selectedDateKey, 1);
  const weekLabel = getWeekLabel(selectedDateKey);

  return `
    <div class="cronograma-calendar-shell">
      <section class="cronograma-calendar-toolbar cronograma-panel">
        <div class="cronograma-calendar-toolbar__main">
          <p class="cronograma-shell__eyebrow">Calendário operacional</p>
          <h2>Visão semanal</h2>
          <p>${escapeHtml(weekLabel)}</p>
        </div>

        <div class="cronograma-calendar-toolbar__actions">
          <button
            class="cronograma-btn cronograma-btn--ghost"
            type="button"
            data-action="shift-week"
            data-date="${previousWeekDate}"
          >
            ← Semana anterior
          </button>
          <button class="cronograma-btn cronograma-btn--ghost" type="button" data-action="go-today">
            Hoje
          </button>
          <button
            class="cronograma-btn"
            type="button"
            data-action="shift-week"
            data-date="${nextWeekDate}"
          >
            Próxima semana →
          </button>
        </div>
      </section>

      ${renderViewSwitch()}

      <section class="cronograma-calendar-kpis">
        ${renderCalendarMetricCard("Tarefas na semana", String(allWeekTasks.length), "Itens com janela ativa")}
        ${renderCalendarMetricCard("Atrasadas", String(allWeekTasks.filter((task) => isTaskOverdue(task)).length), "Pendências vencidas", allWeekTasks.some((task) => isTaskOverdue(task)) ? "danger" : "")}
        ${renderCalendarMetricCard("Responsáveis", String(countUniqueResponsaveis(allWeekTasks)), "Carga distribuída")}
        ${renderCalendarMetricCard("Projetos", String(new Set(allWeekTasks.map((task) => formatProjeto(task))).size), "Frentes ativas")}
      </section>

      <section class="cronograma-panel cronograma-calendar-filters">
        <div class="cronograma-section-head cronograma-section-head--stack-mobile">
          <div>
            <h3>Filtros</h3>
            <p>Refine a leitura da semana por projeto, responsável e fase.</p>
          </div>
          <label class="cronograma-toggle">
            <input type="checkbox" data-action="toggle-archived-calendar" ${state.calendarioMostrarArquivadas ? "checked" : ""} />
            <span>Mostrar arquivadas</span>
          </label>
        </div>

        <div class="cronograma-filter-row cronograma-filter-row--wide">
          <label class="cronograma-field">
            <span>Projeto</span>
            <select data-action="filter-calendar-projeto">
              <option value="todos">Todos</option>
              ${renderSelectOptions(getProjetoOptions(), state.calendarioFiltroProjeto)}
            </select>
          </label>

          <label class="cronograma-field">
            <span>Responsável</span>
            <select data-action="filter-calendar-responsavel">
              <option value="todos">Todos</option>
              ${renderSelectOptions(getResponsavelOptions(), state.calendarioFiltroResponsavel)}
            </select>
          </label>

          <label class="cronograma-field">
            <span>Fase</span>
            <select data-action="filter-calendar-fase">
              <option value="todos">Todas</option>
              ${renderSelectOptions(getFaseOptions(), state.calendarioFiltroFase)}
            </select>
          </label>
        </div>
      </section>

      <section class="cronograma-calendar-week">
        ${weekDays.map((day) => renderWeekDayColumn(day, tasksByDay.get(day.key) || [])).join("")}
      </section>
    </div>
  `;
}

function getCalendarioTimelineTemplate() {
  const tasks = getFilteredTasks();
  const timeline = getTimelineRange();
  const startLabel = timeline.start.toLocaleDateString("pt-BR");
  const endLabel = timeline.end.toLocaleDateString("pt-BR");
  const groups = groupTasksForTimeline(tasks);

  return `
    <div class="cronograma-calendar-shell">

    <section class="cronograma-calendar-toolbar cronograma-panel">
      <div class="cronograma-calendar-toolbar__main">
        <p class="cronograma-shell__eyebrow">Planejamento</p>
        <h2>Linha do tempo</h2>
        <p>Período exibido: ${escapeHtml(startLabel)} → ${escapeHtml(endLabel)}</p>
      </div>
    
      <div class="cronograma-calendar-toolbar__actions">
        <button
          class="cronograma-btn cronograma-btn--ghost"
          type="button"
          data-action="shift-timeline"
          data-offset="-1"
        >
          ← Anterior
        </button>
    
        <button
          class="cronograma-btn cronograma-btn--ghost"
          type="button"
          data-action="go-today"
        >
          Hoje
        </button>
    
        <button
          class="cronograma-btn"
          type="button"
          data-action="shift-timeline"
          data-offset="1"
        >
          Próximo →
        </button>
    
        <label class="cronograma-field cronograma-field--timeline-range">
          <span>Intervalo</span>
          <select data-action="timeline-range">
            ${renderTimelineRangeOptions(timelineRangeDays)}
          </select>
        </label>
      </div>
    </section>

      ${renderViewSwitch()}

      <section
        class="cronograma-timeline"
        style="--timeline-days: ${timeline.totalDays};"
      >

        <div class="cronograma-timeline-grid">
          ${Array.from({ length: timeline.totalDays }).map((_, i) => {
            const d = new Date(timeline.start);
            d.setDate(d.getDate() + i);

            return `<div class="cronograma-timeline-day">
              ${d.getDate()}
            </div>`;
          }).join("")}
        </div>

        ${groups.map(([project, projectTasks]) => `
          <div class="cronograma-timeline-row">
            <div class="cronograma-timeline-row__label">
              ${escapeHtml(project)}
            </div>

            <div class="cronograma-timeline-row__bars">
              ${projectTasks
                .filter(t => getDateRangeForTask(t))
                .map(t => renderTimelineBar(t, timeline.start))
                .join("")}
            </div>
          </div>
        `).join("")}

      </section>
    </div>
  `;
}

function getCalendarioDayTemplate() {
  const selectedDateKey = getSelectedDateKey();
  const tasks = getTasksForSelectedDate();
  const dateLabel = formatDateLong(selectedDateKey);
  const previousDate = parseDateKey(selectedDateKey);
  const nextDate = parseDateKey(selectedDateKey);

  if (previousDate) previousDate.setDate(previousDate.getDate() - 1);
  if (nextDate) nextDate.setDate(nextDate.getDate() + 1);

  return `
    <div class="cronograma-calendar-shell">
      <section class="cronograma-calendar-toolbar cronograma-panel">
        <div class="cronograma-calendar-toolbar__main">
          <p class="cronograma-shell__eyebrow">Calendário operacional</p>
          <h2>Visão diária</h2>
          <p>${escapeHtml(dateLabel)}</p>
        </div>

        <div class="cronograma-calendar-toolbar__actions">
          <button
            class="cronograma-btn cronograma-btn--ghost"
            type="button"
            data-action="select-date"
            data-date="${previousDate ? toDateKey(previousDate) : selectedDateKey}"
          >
            ← Dia anterior
          </button>
          <button class="cronograma-btn cronograma-btn--ghost" type="button" data-action="go-today">
            Hoje
          </button>
          <button
            class="cronograma-btn"
            type="button"
            data-action="select-date"
            data-date="${nextDate ? toDateKey(nextDate) : selectedDateKey}"
          >
            Próximo dia →
          </button>
        </div>
      </section>

      ${renderViewSwitch()}

      <section class="cronograma-calendar-kpis">
        ${renderCalendarMetricCard("Tarefas no dia", String(tasks.length), "Itens que cruzam a data selecionada")}
        ${renderCalendarMetricCard("Atrasadas", String(tasks.filter((task) => isTaskOverdue(task)).length), "Pendências vencidas", tasks.some((task) => isTaskOverdue(task)) ? "danger" : "")}
        ${renderCalendarMetricCard("Responsáveis", String(countUniqueResponsaveis(tasks)), "Carga distribuída")}
        ${renderCalendarMetricCard("Projetos", String(new Set(tasks.map((task) => formatProjeto(task))).size), "Frentes ativas")}
      </section>

      <section class="cronograma-panel cronograma-calendar-filters">
        <div class="cronograma-section-head cronograma-section-head--stack-mobile">
          <div>
            <h3>Filtros</h3>
            <p>Refine a leitura do dia por projeto, responsável e fase.</p>
          </div>
          <label class="cronograma-toggle">
            <input type="checkbox" data-action="toggle-archived-calendar" ${state.calendarioMostrarArquivadas ? "checked" : ""} />
            <span>Mostrar arquivadas</span>
          </label>
        </div>

        <div class="cronograma-filter-row cronograma-filter-row--wide">
          <label class="cronograma-field">
            <span>Projeto</span>
            <select data-action="filter-calendar-projeto">
              <option value="todos">Todos</option>
              ${renderSelectOptions(getProjetoOptions(), state.calendarioFiltroProjeto)}
            </select>
          </label>

          <label class="cronograma-field">
            <span>Responsável</span>
            <select data-action="filter-calendar-responsavel">
              <option value="todos">Todos</option>
              ${renderSelectOptions(getResponsavelOptions(), state.calendarioFiltroResponsavel)}
            </select>
          </label>

          <label class="cronograma-field">
            <span>Fase</span>
            <select data-action="filter-calendar-fase">
              <option value="todos">Todas</option>
              ${renderSelectOptions(getFaseOptions(), state.calendarioFiltroFase)}
            </select>
          </label>
        </div>
      </section>

      <section class="cronograma-calendar-day-view">
        ${
          tasks.length
            ? (() => {
                const groups = classifyDayTasks(tasks, selectedDateKey);
      
                return `
                  ${renderTaskGroup("🔥 Em atraso", groups.overdue, selectedDateKey)}
                  ${renderTaskGroup("📦 Entregas de hoje", groups.dueToday, selectedDateKey)}
                  ${renderTaskGroup("🚀 Começando hoje", groups.startingToday, selectedDateKey)}
                  ${renderTaskGroup("⚡ Alta prioridade", groups.highPriority, selectedDateKey)}
                  ${renderTaskGroup("📋 Demais tarefas", groups.others, selectedDateKey)}
                `;
              })()
            : `
              <section class="cronograma-panel">
                <div class="cronograma-empty-state">
                  Nenhuma tarefa cruza esta data. Um dia manso, quase suspeito.
                </div>
              </section>
            `
        }
      </section>
    </div>
  `;
}

function renderTaskGroup(title, tasks, selectedDateKey) {
  if (!tasks.length) return "";

  return `
    <div class="cronograma-day-group">
      <h3 class="cronograma-day-group__title">${escapeHtml(title)}</h3>
      <div class="cronograma-day-group__list">
        ${tasks.map((task) => renderDayTaskCard(task, selectedDateKey)).join("")}
      </div>
    </div>
  `;
}

function getCalendarioTemplate() {
  const monthAnchor = getMonthAnchor(state.calendarioMesReferencia);
  const monthLabel = getMonthLabel(monthAnchor);
  const monthRange = getMonthRange(monthAnchor);
  const calendarMatrix = buildMonthMatrix(monthAnchor);
  const filteredTasks = getFilteredTasks();
  const dayIndex = buildDayIndex(
    filteredTasks,
    calendarMatrix[0][0].key,
    calendarMatrix[calendarMatrix.length - 1][6].key
  );
  const metrics = getCalendarMetrics(filteredTasks, monthRange);
  const selectedDateKey = getSelectedDateKey();
  const weekdayLabels = getWeekdayLabels();
  const projetoOptions = getProjetoOptions();
  const responsavelOptions = getResponsavelOptions();
  const faseOptions = getFaseOptions();

  const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return `
    <div class="cronograma-calendar-shell">
      <section class="cronograma-calendar-toolbar cronograma-panel">
        <div class="cronograma-calendar-toolbar__main">
          <p class="cronograma-shell__eyebrow">Calendário operacional</p>
          <h2>${escapeHtml(monthTitle)}</h2>
          <p>Visão mensal consolidada para leitura rápida, seleção por dia e operação contínua.</p>
        </div>

        <div class="cronograma-calendar-toolbar__actions">
          <button class="cronograma-btn cronograma-btn--ghost" type="button" data-action="shift-month" data-offset="-1">← Anterior</button>
          <button class="cronograma-btn cronograma-btn--ghost" type="button" data-action="go-today">Hoje</button>
          <button class="cronograma-btn" type="button" data-action="shift-month" data-offset="1">Próximo →</button>
        </div>
      </section>

      ${renderViewSwitch()}

      <section class="cronograma-calendar-kpis">
        ${renderCalendarMetricCard("Tarefas no mês", String(metrics.visibleInMonth.length), "Itens com janela ativa")}
        ${renderCalendarMetricCard("Atrasadas", String(metrics.overdue), "Pendências vencidas", metrics.overdue ? "danger" : "")}
        ${renderCalendarMetricCard("Próximas 7 dias", String(metrics.upcoming), "Radar de curto prazo", metrics.upcoming ? "warning" : "")}
        ${renderCalendarMetricCard("Responsáveis", String(metrics.responsaveis), "Carga distribuída")}
      </section>

      <section class="cronograma-panel cronograma-calendar-filters">
        <div class="cronograma-section-head cronograma-section-head--stack-mobile">
          <div>
            <h3>Filtros</h3>
            <p>Refine a leitura por projeto, responsável e fase sem desmontar a visão do mês.</p>
          </div>
          <label class="cronograma-toggle">
            <input type="checkbox" data-action="toggle-archived-calendar" ${state.calendarioMostrarArquivadas ? "checked" : ""} />
            <span>Mostrar arquivadas</span>
          </label>
        </div>

        <div class="cronograma-filter-row cronograma-filter-row--wide">
          <label class="cronograma-field">
            <span>Projeto</span>
            <select data-action="filter-calendar-projeto">
              <option value="todos">Todos</option>
              ${renderSelectOptions(projetoOptions, state.calendarioFiltroProjeto)}
            </select>
          </label>

          <label class="cronograma-field">
            <span>Responsável</span>
            <select data-action="filter-calendar-responsavel">
              <option value="todos">Todos</option>
              ${renderSelectOptions(responsavelOptions, state.calendarioFiltroResponsavel)}
            </select>
          </label>

          <label class="cronograma-field">
            <span>Fase</span>
            <select data-action="filter-calendar-fase">
              <option value="todos">Todas</option>
              ${renderSelectOptions(faseOptions, state.calendarioFiltroFase)}
            </select>
          </label>
        </div>
      </section>

      <section class="cronograma-panel cronograma-calendar-main cronograma-calendar-main--full">
        <div class="cronograma-calendar-main__top">
          <div class="cronograma-calendar-legend">
            ${getFaseOptions().map((item) => `
              <span class="cronograma-calendar-legend__item">
                <span class="cronograma-calendar-legend__dot cronograma-calendar-legend__dot--${FASE_META[item.value]?.tone || "planejamento"}"></span>
                ${escapeHtml(item.label)}
              </span>
            `).join("")}
          </div>
        </div>

        <div class="cronograma-calendar-grid-wrap">
          <div class="cronograma-calendar-grid-head">
            ${weekdayLabels.map((label) => `
              <div class="cronograma-calendar-grid-head__cell">${escapeHtml(label)}</div>
            `).join("")}
          </div>

          <div class="cronograma-calendar-grid">
            ${calendarMatrix.map((week) =>
              week.map((day) =>
                renderDayCell(day, dayIndex.get(day.key) || [], day.key === selectedDateKey)
              ).join("")
            ).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}
function closeTaskModal() {
  const overlay = document.querySelector(".cronograma-modal-overlay");
  if (!overlay) return;

  overlay.remove();
  setTarefaEditandoId(null);
}

function renderTaskModalContent(overlay) {
  if (!overlay) return;

  const taskId = overlay.dataset.taskId;
  const container = overlay.querySelector("#modalTaskContent");
  if (!taskId || !container) return;

  renderTarefaEditorInContainer(container, taskId, {
    onAfterSave: () => {
      // o listener do Firestore vai refletir os dados novos
      // aqui só mantemos o modal vivo e o calendário no contexto certo
    },
    onCancelEdit: () => {
      closeTaskModal();
    }
  });
}

function openTaskModal(taskId) {
  if (!taskId) return;

  closeTaskModal();

  const overlay = document.createElement("div");
  overlay.className = "cronograma-modal-overlay";
  overlay.dataset.taskId = taskId;

  overlay.innerHTML = `
    <div class="cronograma-modal">
      <div class="cronograma-modal__header">
        <h3>Editar tarefa</h3>
        <button class="cronograma-btn cronograma-btn--ghost" type="button" data-action="close-modal">
          ✕
        </button>
      </div>

      <div class="cronograma-modal__content" id="modalTaskContent">
        <div class="cronograma-empty-state">Carregando...</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener("click", (event) => {
    if (
      event.target.classList.contains("cronograma-modal-overlay") ||
      event.target.closest('[data-action="close-modal"]')
    ) {
      closeTaskModal();
    }
  });

  renderTaskModalContent(overlay);
}


function openTaskFromCalendar(taskId) {
  if (!taskId) return;

  setView("tarefas");
  updateActiveNav("tarefas");

  setTimeout(() => {
    openTarefaEditor(taskId, { scrollToTop: true });
  }, 0);
}

function handleCalendarClick(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;

  const { action } = actionEl.dataset;

  if (action === "shift-month") {
    const offset = Number(actionEl.dataset.offset || 0);
    const nextMonth = shiftMonth(state.calendarioMesReferencia, offset);
    setCalendarioMesReferencia(toDateKey(nextMonth));
    const nextSelectedDate = toDateKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
    setCalendarioDataSelecionada(nextSelectedDate);
    renderCalendarioView();
    return;
  }

  if (action === "shift-week") {
  const date = actionEl.dataset.date || getTodayKey();
  setCalendarioDataSelecionada(date);

  const selected = parseDateKey(date);
  if (selected) {
    setCalendarioMesReferencia(
      toDateKey(new Date(selected.getFullYear(), selected.getMonth(), 1))
    );
  }

  renderCalendarioView();
  return;
  }

  if (action === "shift-timeline") {
    const direction = Number(actionEl.dataset.offset || 0);
    const step = getTimelineStepDays();
    const nextDate = shiftTimeline(getSelectedDateKey(), direction * step);
  
    setCalendarioDataSelecionada(nextDate);
  
    const selected = parseDateKey(nextDate);
    if (selected) {
      setCalendarioMesReferencia(
        toDateKey(new Date(selected.getFullYear(), selected.getMonth(), 1))
      );
    }
  
    renderCalendarioView();
    return;
  }
  
  if (action === "go-today") {
    const today = getTodayKey();
    setCalendarioMesReferencia(`${today.slice(0, 7)}-01`);
    setCalendarioDataSelecionada(today);
    renderCalendarioView();
    return;
  }

  if (action === "open-day") {
    const { date } = actionEl.dataset;
    if (date) {
      setCalendarioDataSelecionada(date);
      const selected = parseDateKey(date);
      if (selected) {
        setCalendarioMesReferencia(toDateKey(new Date(selected.getFullYear(), selected.getMonth(), 1)));
      }
      setCalendarioModo("day");
      renderCalendarioView();
    }
    return;
  }

  if (action === "open-task") {
    const taskId = actionEl.dataset.taskId;
    openTaskModal(taskId);
    return;
  }

  if (action === "select-date") {
    const { date } = actionEl.dataset;
    if (date) {
      setCalendarioDataSelecionada(date);
      const selected = parseDateKey(date);
      if (selected) {
        setCalendarioMesReferencia(toDateKey(new Date(selected.getFullYear(), selected.getMonth(), 1)));
      }
      renderCalendarioView();
    }
    return;
  }

  if (action === "set-calendar-mode") {
    const mode = actionEl.dataset.mode || "month";
    if (!["month", "week", "day", "timeline"].includes(mode)) return;
    setCalendarioModo(mode);
    renderCalendarioView();
  }
}

function handleCalendarChange(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;

  const { action } = actionEl.dataset;
  
  if (action === "timeline-range") {
    timelineRangeDays = Number(actionEl.value) || 15;
  }
  if (action === "filter-calendar-projeto") {
    setCalendarioFiltroProjeto(actionEl.value);
  }

  if (action === "filter-calendar-responsavel") {
    setCalendarioFiltroResponsavel(actionEl.value);
  }

  if (action === "filter-calendar-fase") {
    setCalendarioFiltroFase(actionEl.value);
  }

  if (action === "toggle-archived-calendar") {
    setCalendarioMostrarArquivadas(actionEl.checked);
  }

  setCalendarioDataSelecionada(getSelectedDateKey());
  renderCalendarioView();
}

function handleCalendarKeydown(event) {
  const actionEl = event.target.closest(
    '[data-action="select-date"], [data-action="open-day"], [data-action="open-task"]'
  );
  if (!actionEl) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  actionEl.click();
}

function mountCalendarioEvents() {
  const root = document.querySelector(".cronograma-calendar-shell");
  if (!root) return;

  root.addEventListener("click", handleCalendarClick);
  root.addEventListener("change", handleCalendarChange);
  root.addEventListener("keydown", handleCalendarKeydown);
}

function ensureTarefasListener() {
  if (unsubscribeTarefas) return;

  unsubscribeTarefas = listenTarefas(
    (items) => {
      setTarefas(items);

      if (state.currentView === "calendario") {
        renderCalendarioView();
      }
    },
    (error) => {
      console.error(error);
      setTarefas([]);
      if (state.currentView === "calendario") {
        renderIntoApp(`
          <section class="cronograma-panel">
            <div class="cronograma-empty-state cronograma-empty-state--error">
              Não foi possível carregar as tarefas do calendário no Firestore.
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
      if (state.currentView === "calendario") renderCalendarioView();
    },
    (error) => {
      console.error(error);
      setUsers([]);
      if (state.currentView === "calendario") renderCalendarioView();
    }
  );
}

export function renderCalendarioView() {
  ensureTarefasListener();
  ensureUsersListener();
  ensureProjetosListener();

  if (!["month", "week", "day", "timeline"].includes(state.calendarioModo)) {
    setCalendarioModo("month");
  }

  if (!state.calendarioMesReferencia) {
    setCalendarioMesReferencia(`${getTodayKey().slice(0, 7)}-01`);
  }

  if (!state.calendarioDataSelecionada) {
    setCalendarioDataSelecionada(getTodayKey());
  }

  const template =
    state.calendarioModo === "day"
      ? getCalendarioDayTemplate()
      : state.calendarioModo === "week"
        ? getCalendarioWeekTemplate()
        : state.calendarioModo === "timeline"
          ? getCalendarioTimelineTemplate()
          : getCalendarioTemplate();

  
  renderIntoApp(template);
  mountCalendarioEvents();
}
