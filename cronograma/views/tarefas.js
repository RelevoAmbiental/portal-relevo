import { renderIntoApp } from "../ui/layout.js";

export function renderTarefasView() {
  renderIntoApp(`
    <div class="cronograma-view-grid">
      <section class="cronograma-placeholder-card">
        <h2>Lista mestre de tarefas</h2>
        <p>
          Aqui ficará a visão operacional das tarefas vinculadas aos projetos, com filtros por projeto,
          responsável, prioridade, status, prazo e situação de atraso.
        </p>

        <div class="cronograma-checklist">
          <div class="cronograma-checklist__item">Filtro por projeto</div>
          <div class="cronograma-checklist__item">Filtro por responsável</div>
          <div class="cronograma-checklist__item">Atrasadas / prazo próximo</div>
          <div class="cronograma-checklist__item">Checklist e subtarefas</div>
        </div>
      </section>

      <aside class="cronograma-panel">
        <h3>Regras operacionais previstas</h3>
        <div class="cronograma-mini-list">
          <div class="cronograma-mini-list__item">
            <strong>Atrasada</strong>
            <span>Tarefa vencida e ainda não concluída.</span>
          </div>
          <div class="cronograma-mini-list__item">
            <strong>Prazo próximo</strong>
            <span>Tarefa vencendo nos próximos dias.</span>
          </div>
          <div class="cronograma-mini-list__item">
            <strong>Pendência de planejamento</strong>
            <span>Tarefa sem responsável ou sem data definida.</span>
          </div>
        </div>
      </aside>
    </div>
  `);
}
