export const state = {
  currentView: "dashboard",
  projetos: [],
  projetosLoaded: false,
  projetoEditandoId: null,
  mostrarArquivados: false,
  filtroStatusProjeto: "todos"
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
