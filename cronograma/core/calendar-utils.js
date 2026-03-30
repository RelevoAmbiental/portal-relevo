const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_MS = 86400000;

function cloneDate(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function parseDateKey(value) {
  if (!value || typeof value !== "string") return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function toDateKey(value) {
  const date = value instanceof Date ? value : parseDateKey(value);
  if (!date || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayKey() {
  return toDateKey(new Date());
}

export function getMonthAnchor(value = new Date()) {
  const date = value instanceof Date ? value : parseDateKey(value) || new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function shiftMonth(anchor, offset) {
  const base = getMonthAnchor(anchor);
  return new Date(base.getFullYear(), base.getMonth() + Number(offset || 0), 1);
}

export function getMonthLabel(anchor) {
  return getMonthAnchor(anchor).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

export function getWeekdayLabels() {
  return [...WEEKDAY_LABELS];
}

function getWeekStartMonday(date) {
  const clone = cloneDate(date);
  const weekday = clone.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  clone.setDate(clone.getDate() + diff);
  return clone;
}

export function buildMonthMatrix(anchor) {
  const monthAnchor = getMonthAnchor(anchor);
  const month = monthAnchor.getMonth();
  const gridStart = getWeekStartMonday(monthAnchor);
  const days = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    days.push({
      date,
      key: toDateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: toDateKey(date) === getTodayKey()
    });
  }

  return Array.from({ length: 6 }, (_, weekIndex) => days.slice(weekIndex * 7, weekIndex * 7 + 7));
}

export function getMonthRange(anchor) {
  const monthAnchor = getMonthAnchor(anchor);
  const start = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const end = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
  return { start, end, startKey: toDateKey(start), endKey: toDateKey(end) };
}

export function getDateRangeForTask(task) {
  const start = parseDateKey(task?.dataInicio);
  const end = parseDateKey(task?.dataVencimento);

  if (!start && !end) return null;
  if (start && end) {
    if (end < start) {
      return {
        start: cloneDate(end),
        end: cloneDate(end),
        hasStart: true,
        hasEnd: true,
        inconsistent: true
      };
    }

    return {
      start: cloneDate(start),
      end: cloneDate(end),
      hasStart: true,
      hasEnd: true,
      inconsistent: false
    };
  }

  const singleDate = start || end;
  return {
    start: cloneDate(singleDate),
    end: cloneDate(singleDate),
    hasStart: Boolean(start),
    hasEnd: Boolean(end),
    inconsistent: false
  };
}

function getPriorityOrder(prioridade) {
  const order = {
    critica: 0,
    alta: 1,
    media: 2,
    baixa: 3
  };
  return order[prioridade] ?? 9;
}

function getStatusOrder(status) {
  const order = {
    andamento: 0,
    acompanhando: 1,
    a_fazer: 2,
    concluida: 3
  };
  return order[status] ?? 9;
}

export function sortCalendarTasks(items) {
  return [...items].sort((a, b) => {
    const aRange = getDateRangeForTask(a);
    const bRange = getDateRangeForTask(b);
    const aStart = aRange ? toDateKey(aRange.start) : "9999-12-31";
    const bStart = bRange ? toDateKey(bRange.start) : "9999-12-31";

    if (aStart !== bStart) return aStart.localeCompare(bStart);

    const aPriority = getPriorityOrder(a?.prioridade);
    const bPriority = getPriorityOrder(b?.prioridade);
    if (aPriority !== bPriority) return aPriority - bPriority;

    const aStatus = getStatusOrder(a?.status);
    const bStatus = getStatusOrder(b?.status);
    if (aStatus !== bStatus) return aStatus - bStatus;

    return String(a?.titulo || "").localeCompare(String(b?.titulo || ""), "pt-BR");
  });
}

export function getTaskDurationDays(task) {
  const range = getDateRangeForTask(task);
  if (!range) return 0;
  return Math.max(1, Math.round((range.end - range.start) / DAY_MS) + 1);
}

export function isTaskOverdue(task, todayKey = getTodayKey()) {
  if (!task || task.arquivada || task.status === "concluida" || !task.dataVencimento) return false;
  return task.dataVencimento < todayKey;
}

export function isTaskUpcoming(task, todayKey = getTodayKey(), daysAhead = 7) {
  if (!task || task.arquivada || task.status === "concluida" || !task.dataVencimento) return false;
  if (task.dataVencimento < todayKey) return false;

  const today = parseDateKey(todayKey) || new Date();
  const due = parseDateKey(task.dataVencimento);
  if (!due) return false;
  const diff = Math.round((due - cloneDate(today)) / DAY_MS);
  return diff >= 0 && diff <= Number(daysAhead || 0);
}

export function taskIntersectsDate(task, dateKey) {
  const range = getDateRangeForTask(task);
  if (!range) return false;
  return dateKey >= toDateKey(range.start) && dateKey <= toDateKey(range.end);
}

export function taskIntersectsRange(task, startKey, endKey) {
  const range = getDateRangeForTask(task);
  if (!range) return false;
  const taskStart = toDateKey(range.start);
  const taskEnd = toDateKey(range.end);
  return taskEnd >= startKey && taskStart <= endKey;
}

export function buildDayIndex(tasks, startKey, endKey) {
  const index = new Map();
  const scopedTasks = sortCalendarTasks(tasks).filter((task) => taskIntersectsRange(task, startKey, endKey));

  scopedTasks.forEach((task) => {
    const range = getDateRangeForTask(task);
    if (!range) return;

    const cursor = cloneDate(range.start);
    const limit = cloneDate(range.end);

    while (cursor <= limit) {
      const key = toDateKey(cursor);
      if (key >= startKey && key <= endKey) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(task);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return index;
}

export function countUniqueResponsaveis(tasks) {
  return new Set(
    tasks
      .map((item) => (item?.responsavel || "").trim())
      .filter(Boolean)
  ).size;
}

export function groupTasksByProjeto(tasks) {
  const map = new Map();

  tasks.forEach((task) => {
    const key = task.projetoId || task.projetoNome || "sem_projeto";
    const current = map.get(key) || {
      projetoId: task.projetoId || "",
      projetoNome: task.projetoNome || "Sem projeto",
      total: 0
    };

    current.total += 1;
    map.set(key, current);
  });

  return [...map.values()].sort((a, b) => b.total - a.total || a.projetoNome.localeCompare(b.projetoNome, "pt-BR"));
}
