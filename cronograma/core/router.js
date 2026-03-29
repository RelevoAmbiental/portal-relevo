import { renderDashboardView } from "../views/dashboard.js";
import { renderProjetosView } from "../views/projetos.js";
import { renderTarefasView } from "../views/tarefas.js";
import { renderCalendarioView } from "../views/calendario.js";
import { renderGestaoView } from "../views/gestao.js";
import { renderImportarView } from "../views/importar.js";

const viewMap = {
  dashboard: renderDashboardView,
  projetos: renderProjetosView,
  tarefas: renderTarefasView,
  calendario: renderCalendarioView,
  gestao: renderGestaoView,
  importar: renderImportarView
};

export function renderCurrentView(view) {
  const renderFn = viewMap[view] || renderDashboardView;
  renderFn();
}
