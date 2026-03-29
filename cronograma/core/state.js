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
  filtroResponsavelTarefa: "todos"
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
