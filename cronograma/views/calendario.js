import { renderIntoApp } from "../ui/layout.js";
import {
  state,
  setTarefas,
  setUsers,
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
  { value: "week", label: "Semanal", enabled: false },
  { value: "day", label: "Diária", enabled: false },
  { value: "timeline", label: "Linha do tempo", enabled: false }
];

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
  return sortCalendarTasks(
    state.tarefas.filter((task) => {
      if (!state.calendarioMostrarArquivadas && task.arquivada) return false;
      if (state.calendarioFiltroProjeto !== "todos") {
        const projectKey = task.projetoId || task.projetoNome;
        if (projectKey !== state.calendarioFiltroProjeto) return false;
      }
      if (state.calendarioFiltroResponsavel !== "todos" && formatResponsavel(task) !== state.calendarioFiltroResponsavel) {
        return false;
      }
      if (state.calendarioFiltroFase !== "todos" && task.fase !== state.calendarioFiltroFase) return false;
      return Boolean(getDateRangeForTask(task));
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
  const projetos = groupTasksByProjeto(visibleInMonth).slice(0, 4);

  return { visibleInMonth, overdue, upcoming, responsaveis, projetos };
}

function getSelectedDateKey() {
  const fallback = state.calendarioDataSelecionada || getTodayKey();
  return fallback;
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
      data-action="select-date"
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
      data-action="select-date"
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
        ${hiddenCount ? `<button type="button" class="cronograma-calendar-day__more" data-action="select-date" data-date="${day.key}">+${hiddenCount} mais</button>` : ""}
      </div>
    </article>
  `;
}

function renderSelectedDatePanel(tasks, selectedDateKey) {
  const dateLabel = formatDateLong(selectedDateKey);

  if (!tasks.length) {
    return `
      <section class="cronograma-panel cronograma-calendar-side-card">
        <div class="cronograma-calendar-side-card__head">
          <h3>${escapeHtml(dateLabel)}</h3>
          <span class="cronograma-tag cronograma-tag--muted">0 tarefas</span>
        </div>
        <div class="cronograma-empty-state">
          Nenhuma tarefa cruza esta data. O calendário está limpo — um raro animal em cativeiro.
        </div>
      </section>
    `;
  }

  return `
    <section class="cronograma-panel cronograma-calendar-side-card">
      <div class="cronograma-calendar-side-card__head">
        <h3>${escapeHtml(dateLabel)}</h3>
        <span class="cronograma-tag">${tasks.length} tarefa${tasks.length > 1 ? "s" : ""}</span>
      </div>

      <div class="cronograma-calendar-agenda-list">
        ${tasks.map((task) => {
          const phaseTone = FASE_META[task.fase]?.tone || "planejamento";
          const duration = getTaskDurationDays(task);
          return `
            <article class="cronograma-calendar-agenda-item cronograma-calendar-agenda-item--${phaseTone}">
              <div class="cronograma-calendar-agenda-item__head">
                <div>
                  <h4>${escapeHtml(task.titulo || "Tarefa")}</h4>
                  <p>${escapeHtml(formatProjeto(task))}</p>
                </div>
                <span class="cronograma-tag cronograma-tag--muted">${duration} dia${duration > 1 ? "s" : ""}</span>
              </div>
              <div class="cronograma-tag-row cronograma-tag-row--tight">
                <span class="cronograma-tag">${escapeHtml(formatFase(task.fase))}</span>
                <span class="cronograma-tag cronograma-tag--info">${escapeHtml(formatPrioridade(task.prioridade))}</span>
                ${isTaskOverdue(task) ? '<span class="cronograma-tag cronograma-tag--danger">Atrasada</span>' : ""}
                ${isTaskUpcoming(task) ? '<span class="cronograma-tag cronograma-tag--warning">Próxima</span>' : ""}
              </div>
              <div class="cronograma-calendar-agenda-item__meta">
                <span><strong>Status:</strong> ${escapeHtml(formatStatus(task.status))}</span>
                <span><strong>Responsável:</strong> ${escapeHtml(formatResponsavel(task))}</span>
                <span><strong>Janela:</strong> ${escapeHtml(formatDate(task.dataInicio))} → ${escapeHtml(formatDate(task.dataVencimento))}</span>
              </div>
              ${task.descricao ? `<p class="cronograma-calendar-agenda-item__desc">${escapeHtml(task.descricao)}</p>` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </section>
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

  if (action === "go-today") {
    const today = getTodayKey();
    setCalendarioMesReferencia(`${today.slice(0, 7)}-01`);
    setCalendarioDataSelecionada(today);
    renderCalendarioView();
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
    if (mode !== "month") return;
    setCalendarioModo(mode);
    renderCalendarioView();
  }
}

function handleCalendarChange(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;

  const { action } = actionEl.dataset;

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

  const selectedDate = getSelectedDateKey();
  setCalendarioDataSelecionada(selectedDate);
  renderCalendarioView();
}


function handleCalendarKeydown(event) {
  const actionEl = event.target.closest('[data-action="select-date"]');
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
      if (state.currentView === "calendario") renderCalendarioView();
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

  if (state.calendarioModo !== "month") {
    setCalendarioModo("month");
  }

  if (!state.calendarioMesReferencia) {
    setCalendarioMesReferencia(`${getTodayKey().slice(0, 7)}-01`);
  }

  if (!state.calendarioDataSelecionada) {
    setCalendarioDataSelecionada(getTodayKey());
  }

  renderIntoApp(getCalendarioTemplate());
  mountCalendarioEvents();
}
