import { renderIntoApp } from "../ui/layout.js";

export function renderProjetosView() {
  renderIntoApp(`
    <div class="cronograma-view-grid">
      <section class="cronograma-placeholder-card">
        <h2>Base de projetos</h2>
        <p>
          Esta aba será a porta de entrada para cadastro, edição e arquivamento dos projetos, mantendo
          consulta posterior aos concluídos sempre que necessário.
        </p>

        <div class="cronograma-checklist">
          <div class="cronograma-checklist__item">Cadastro de projetos</div>
          <div class="cronograma-checklist__item">Edição rápida</div>
          <div class="cronograma-checklist__item">Arquivamento controlado</div>
          <div class="cronograma-checklist__item">Consulta de concluídos</div>
        </div>
      </section>

      <aside class="cronograma-panel">
        <h3>Campos previstos</h3>
        <div class="cronograma-mini-list">
          <div class="cronograma-mini-list__item"><strong>Nome / Cliente / Nº da proposta</strong></div>
          <div class="cronograma-mini-list__item"><strong>Status / responsável / prazo final</strong></div>
          <div class="cronograma-mini-list__item"><strong>Cor / descrição / arquivamento</strong></div>
        </div>
      </aside>
    </div>
  `);
}
