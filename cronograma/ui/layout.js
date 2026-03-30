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
      "Visualização mensal das tarefas já em produção, com arquitetura preparada para evolução futura para escalas semanal, diária e linha do tempo."
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

export function setPageMeta(view) {
  const meta = viewMeta[view] || viewMeta.dashboard;
  getEl("pageTitle").textContent = meta.title;
  getEl("pageDescription").textContent = meta.description;
}

export function updateActiveNav(view) {
  setPageMeta(view);

  document.querySelectorAll(".portal-nav-item[data-view]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === view);
  });
}

export function renderIntoApp(html) {
  getEl("appView").innerHTML = html;
}

export function openDrawer() {
  const drawer = getEl("drawer");
  const overlay = getEl("drawerOverlay");
  if (drawer) drawer.classList.add("is-open");
  if (overlay) overlay.classList.add("is-open");
}

export function closeDrawer() {
  const drawer = getEl("drawer");
  const overlay = getEl("drawerOverlay");
  if (drawer) drawer.classList.remove("is-open");
  if (overlay) overlay.classList.remove("is-open");
}

export function bindLayoutEvents(onNavigate) {
  document.querySelectorAll(".portal-nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      onNavigate(view);
      closeDrawer();
    });
  });

  const btnOpen = getEl("btnOpenSidebar");
  const btnClose = getEl("btnCloseSidebar");
  const overlay = getEl("drawerOverlay");

  if (btnOpen) btnOpen.addEventListener("click", openDrawer);
  if (btnClose) btnClose.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);
}
