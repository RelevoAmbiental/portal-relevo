import { renderIntoApp } from "../ui/layout.js";

export function renderCalendarioView() {
  renderIntoApp(`
    <div class="cronograma-view-grid">
      <section class="cronograma-placeholder-card">
        <h2>Calendário do cronograma</h2>
        <p>
          O calendário mostrará as tarefas por dia, semana, mês e, depois, em visão anual resumida,
          sempre indicando projeto, responsável, prazo próximo e atraso.
        </p>

        <div class="cronograma-checklist">
          <div class="cronograma-checklist__item">Visão diária</div>
          <div class="cronograma-checklist__item">Visão semanal</div>
          <div class="cronograma-checklist__item">Visão mensal</div>
          <div class="cronograma-checklist__item">Visão anual resumida</div>
        </div>
      </section>

      <aside class="cronograma-panel">
        <h3>Prioridade de implementação</h3>
        <div class="cronograma-mini-list">
          <div class="cronograma-mini-list__item"><strong>Fase 1</strong><span>Mensal, semanal e lista diária.</span></div>
          <div class="cronograma-mini-list__item"><strong>Fase 2</strong><span>Visão anual resumida e refinamentos.</span></div>
        </div>
      </aside>
    </div>
  `);
}
