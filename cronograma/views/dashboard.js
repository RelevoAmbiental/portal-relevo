import { renderIntoApp } from "../ui/layout.js";

export function renderDashboardView() {
  renderIntoApp(`
    <div class="cronograma-view-grid">
      <section class="cronograma-placeholder-card">
        <h2>Dashboard em preparação</h2>
        <p>
          Aqui entrarão os indicadores principais do cronograma: projetos ativos, tarefas em aberto,
          atrasos, vencimentos próximos, evolução de conclusão e gargalos operacionais.
        </p>

        <div class="cronograma-tag-row">
          <span class="cronograma-tag">Projetos ativos</span>
          <span class="cronograma-tag">Atrasos</span>
          <span class="cronograma-tag">Prazos próximos</span>
          <span class="cronograma-tag">Conclusões do período</span>
        </div>
      </section>

      <aside class="cronograma-panel">
        <h3>Visões úteis para a Gestão</h3>
        <div class="cronograma-mini-list">
          <div class="cronograma-mini-list__item">
            <strong>Entregas da semana</strong>
            <span>Lista rápida das tarefas com vencimento nos próximos dias.</span>
          </div>
          <div class="cronograma-mini-list__item">
            <strong>Projetos com maior passivo</strong>
            <span>Resumo dos projetos com mais tarefas abertas ou atrasadas.</span>
          </div>
          <div class="cronograma-mini-list__item">
            <strong>Carga por responsável</strong>
            <span>Base para distribuição de atividades e acompanhamento interno.</span>
          </div>
        </div>
      </aside>
    </div>
  `);
}
