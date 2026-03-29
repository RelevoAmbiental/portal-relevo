import { renderIntoApp } from "../ui/layout.js";

export function renderGestaoView() {
  renderIntoApp(`
    <div class="cronograma-view-grid">
      <section class="cronograma-placeholder-card">
        <h2>Gestão visual do cronograma</h2>
        <p>
          Esta área vai concentrar visões operacionais complementares, como Kanban, prioridades, gargalos,
          visão por responsável e outras leituras úteis para a rotina da equipe.
        </p>

        <div class="cronograma-checklist">
          <div class="cronograma-checklist__item">Kanban por status</div>
          <div class="cronograma-checklist__item">Visão por responsável</div>
          <div class="cronograma-checklist__item">Pendências críticas</div>
          <div class="cronograma-checklist__item">Priorização operacional</div>
        </div>
      </section>

      <aside class="cronograma-panel">
        <h3>Sugestão de evolução</h3>
        <div class="cronograma-mini-list">
          <div class="cronograma-mini-list__item"><strong>Primeiro</strong><span>Kanban e visão por responsável.</span></div>
          <div class="cronograma-mini-list__item"><strong>Depois</strong><span>Gantt simplificado e matriz Eisenhower.</span></div>
        </div>
      </aside>
    </div>
  `);
}
