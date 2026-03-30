export const state = {
  currentView: "dashboard",

  projetos: [],
  projetosLoaded: false,
  projetoEditandoId: null,
  mostrarArquivados: false,
  filtroStatusProjeto: "todos",

  tarefas: [],
  tarefasLoaded: false,
  tarefaEditandoId: null,
  mostrarTarefasArquivadas: false,
  filtroProjetoTarefa: "todos",
  filtroStatusTarefa: "todos",
  filtroResponsavelTarefa: "todos",
  filtroFaseTarefa: "todos",

  users: [],
  usersLoaded: false,

  calendarioMesReferencia: new Date().toISOString().slice(0, 7) + "-01",
  calendarioDataSelecionada: new Date().toISOString().slice(0, 10),
  calendarioModo: "month",
  calendarioFiltroProjeto: "todos",
  calendarioFiltroResponsavel: "todos",
  calendarioFiltroFase: "todos",
  calendarioMostrarArquivadas: false
};

export function setView(view) {
  state.currentView = view;
}

export function setProjetos(items) {
  state.projetos = Array.isArray(items) ? items : [];
  state.projetosLoaded = true;
}

export function setProjetoEditandoId(id) {
  state.projetoEditandoId = id || null;
}

export function setMostrarArquivados(value) {
  state.mostrarArquivados = Boolean(value);
}

export function setFiltroStatusProjeto(value) {
  state.filtroStatusProjeto = value || "todos";
}

export function setTarefas(items) {
  state.tarefas = Array.isArray(items) ? items : [];
  state.tarefasLoaded = true;
}

export function setTarefaEditandoId(id) {
  state.tarefaEditandoId = id || null;
}

export function setMostrarTarefasArquivadas(value) {
  state.mostrarTarefasArquivadas = Boolean(value);
}

export function setFiltroProjetoTarefa(value) {
  state.filtroProjetoTarefa = value || "todos";
}

export function setFiltroStatusTarefa(value) {
  state.filtroStatusTarefa = value || "todos";
}

export function setFiltroResponsavelTarefa(value) {
  state.filtroResponsavelTarefa = value || "todos";
}

export function setFiltroFaseTarefa(value) {
  state.filtroFaseTarefa = value || "todos";
}

export function setUsers(items) {
  state.users = Array.isArray(items) ? items : [];
  state.usersLoaded = true;
}


export function setCalendarioMesReferencia(value) {
  state.calendarioMesReferencia = value || new Date().toISOString().slice(0, 7) + "-01";
}

export function setCalendarioDataSelecionada(value) {
  state.calendarioDataSelecionada = value || new Date().toISOString().slice(0, 10);
}

export function setCalendarioModo(value) {
  state.calendarioModo = value || "month";
}

export function setCalendarioFiltroProjeto(value) {
  state.calendarioFiltroProjeto = value || "todos";
}

export function setCalendarioFiltroResponsavel(value) {
  state.calendarioFiltroResponsavel = value || "todos";
}

export function setCalendarioFiltroFase(value) {
  state.calendarioFiltroFase = value || "todos";
}

export function setCalendarioMostrarArquivadas(value) {
  state.calendarioMostrarArquivadas = Boolean(value);
}
