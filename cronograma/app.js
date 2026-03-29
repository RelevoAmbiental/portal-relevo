const viewMeta = {
  dashboard: {
    title: "Dashboard",
    description:
      "Visão executiva do cronograma com indicadores, pendências, prazos próximos e resumos operacionais dos projetos."
  },
  projetos: {
    title: "Projetos",
    description:
      "Cadastro, edição, arquivamento e consulta de projetos ativos e concluídos, com estrutura alinhada ao Portal Relevo."
  },
  tarefas: {
    title: "Tarefas",
    description:
      "Lista mestre de tarefas vinculadas aos projetos, com filtros por status, responsável, prazo e prioridade."
  },
  calendario: {
    title: "Calendário",
    description:
      "Visualização diária, semanal, mensal e anual das tarefas, destacando vencimentos, atrasos e prazos próximos."
  },
  gestao: {
    title: "Gestão",
    description:
      "Painéis operacionais complementares do cronograma, como Kanban, prioridades, gargalos e visão por responsável."
  },
  importar: {
    title: "Importar Tarefas",
    description:
      "Importação estruturada de tarefas por arquivo TXT, com revisão prévia antes do salvamento no Firestore."
  }
};

function getEl(id) {
  return document.getElementById(id);
}

function setActiveNav(view) {
  document.querySelectorAll(".portal-nav-item[data-view]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === view);
  });
}

function renderView(view) {
  const meta = viewMeta[view] || viewMeta.dashboard;

  getEl("pageTitle").textContent = meta.title;
  getEl("pageDescription").textContent = meta.description;
  getEl("appView").innerHTML = getViewTemplate(view);
  setActiveNav(view);
}

function getViewTemplate(view) {
  switch (view) {
    case "dashboard":
      return `
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
      `;

    case "projetos":
      return `
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
      `;

    case "tarefas":
      return `
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
      `;

    case "calendario":
      return `
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
      `;

    case "gestao":
      return `
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
      `;

    case "importar":
      return `
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
      `;

    default:
      return `
        <section class="cronograma-placeholder-card">
          <h2>Módulo em preparação</h2>
          <p>Visual não reconhecido. Voltando para a base do cronograma.</p>
        </section>
      `;
  }
}

function bindNav() {
  document.querySelectorAll(".portal-nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      renderView(view);
      closeDrawer();
    });
  });
}

function openDrawer() {
  const drawer = getEl("drawer");
  const overlay = getEl("drawerOverlay");
  if (drawer) drawer.classList.add("is-open");
  if (overlay) overlay.classList.add("is-open");
}

function closeDrawer() {
  const drawer = getEl("drawer");
  const overlay = getEl("drawerOverlay");
  if (drawer) drawer.classList.remove("is-open");
  if (overlay) overlay.classList.remove("is-open");
}

function bindDrawer() {
  const btnOpen = getEl("btnOpenSidebar");
  const btnClose = getEl("btnCloseSidebar");
  const overlay = getEl("drawerOverlay");

  if (btnOpen) btnOpen.addEventListener("click", openDrawer);
  if (btnClose) btnClose.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);
}

function init() {
  bindNav();
  bindDrawer();
  renderView("dashboard");
}

document.addEventListener("DOMContentLoaded", init);
