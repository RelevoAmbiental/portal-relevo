import { renderIntoApp } from "../ui/layout.js";

export function renderImportarView() {
  renderIntoApp(`
    <div class="cronograma-view-grid">
      <section class="cronograma-placeholder-card">
        <h2>Importação por TXT estruturado</h2>
        <p>
          O antigo fluxo com IA foi aposentado. Esta nova aba receberá arquivos TXT com estrutura por fases
          e duração estimada, permitindo revisão antes de gravar as tarefas no Firestore.
        </p>

        <div class="cronograma-checklist">
          <div class="cronograma-checklist__item">Sem gateway</div>
          <div class="cronograma-checklist__item">Sem Cloud Functions</div>
          <div class="cronograma-checklist__item">Sem OpenAI API</div>
          <div class="cronograma-checklist__item">Processamento local no frontend</div>
        </div>
      </section>

      <aside class="cronograma-panel">
        <h3>Formato previsto</h3>
        <div class="cronograma-mini-list">
          <div class="cronograma-mini-list__item">
            <strong>[FASE] Campo</strong>
            <span>- Prospecção espeleológica | 5d</span>
          </div>
          <div class="cronograma-mini-list__item">
            <strong>[FASE] Gabinete</strong>
            <span>- Relatório técnico | 6d</span>
          </div>
        </div>
      </aside>
    </div>
  `);
}
