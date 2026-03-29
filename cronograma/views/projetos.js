import { renderIntoApp } from "../ui/layout.js";
import {
  state,
  setProjetos,
  setProjetoEditandoId,
  setMostrarArquivados,
  setFiltroStatusProjeto
} from "../core/state.js";
import {
  listenProjetos,
  criarProjeto,
  atualizarProjeto,
  arquivarProjeto,
  desarquivarProjeto
} from "../services/firestore-projetos.js";

let unsubscribeProjetos = null;

const STATUS_OPTIONS = [
  { value: "planejamento", label: "Planejamento" },
  { value: "andamento", label: "Em andamento" },
  { value: "acompanhamento", label: "Acompanhamento" },
  { value: "concluido", label: "Concluído" }
];

const CORES = [
  "#0B6E4F", // verde escuro
  "#1D4ED8", // azul
  "#7C3AED", // roxo
  "#C026D3", // magenta
  "#BE123C", // vinho
  "#EA580C", // laranja
  "#CA8A04", // mostarda
  "#4D7C0F", // oliva
  "#374151"  // grafite
];

function getProjetoInicial() {
  return {
    nome: "",
    cliente: "Relevo Consultoria Ambiental",
    propostaNumero: "",
    responsavel: "",
    dataInicio: "",
    prazoFinal: "",
    status: "planejamento",
    cor: "#0b2e1b",
    descricao: ""
  };
}

function formatStatus(status) {
  const item = STATUS_OPTIONS.find((opt) => opt.value === status);
  return item?.label || "Sem status";
}

function getProjetosFiltrados() {
  return state.projetos.filter((item) => {
    if (!state.mostrarArquivados && item.arquivado) return false;
    if (state.filtroStatusProjeto !== "todos" && item.status !== state.filtroStatusProjeto) return false;
    return true;
  });
}

function getProjetoById(id) {
  return state.projetos.find((item) => item.id === id) || null;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProjetoCard(item) {
  const prazo = item.prazoFinal
    ? new Date(`${item.prazoFinal}T00:00:00`).toLocaleDateString("pt-BR")
    : "Não informado";

  return `
    <article class="cronograma-project-card ${item.arquivado ? "is-archived" : ""}">
      <div class="cronograma-project-card__head">
        <div class="cronograma-project-card__title-wrap">
          <span class="cronograma-project-card__color" style="background:${escapeHtml(item.cor || "#0b2e1b")}"></span>
          <div>
            <h3>${escapeHtml(item.nome)}</h3>
            <p>${escapeHtml(item.cliente || "Cliente não informado")}</p>
          </div>
        </div>

        <div class="cronograma-tag-row cronograma-tag-row--tight">
          <span class="cronograma-tag">${escapeHtml(formatStatus(item.status))}</span>
          ${item.arquivado ? '<span class="cronograma-tag cronograma-tag--muted">Arquivado</span>' : ""}
        </div>
      </div>

      <div class="cronograma-project-card__meta">
        <div><strong>Proposta:</strong> ${escapeHtml(item.propostaNumero || "—")}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(item.responsavel || "—")}</div>
        <div><strong>Prazo final:</strong> ${escapeHtml(prazo)}</div>
      </div>

      ${
        item.descricao
          ? `<p class="cronograma-project-card__desc">${escapeHtml(item.descricao)}</p>`
          : ""
      }

      <div class="cronograma-project-card__actions">
        <button class="cronograma-btn cronograma-btn--ghost" type="button" data-action="editar-projeto" data-id="${item.id}">
          Editar
        </button>

        ${
          item.arquivado
            ? `<button class="cronograma-btn cronograma-btn--secondary" type="button" data-action="desarquivar-projeto" data-id="${item.id}">
                Desarquivar
              </button>`
            : `<button class="cronograma-btn cronograma-btn--secondary" type="button" data-action="arquivar-projeto" data-id="${item.id}">
                Arquivar
              </button>`
        }
      </div>
    </article>
  `;
}

function getProjetosTemplate() {
  const projetos = getProjetosFiltrados();
  const projetoEditando = state.projetoEditandoId ? getProjetoById(state.projetoEditandoId) : null;
  const projetoBase = projetoEditando || getProjetoInicial();

  return `
    <section class="cronograma-projetos-page">
      <div class="cronograma-view-grid cronograma-view-grid--projects">
        <section class="cronograma-panel">
          <div class="cronograma-section-head">
            <div>
              <p class="cronograma-section-head__eyebrow">Cadastro</p>
              <h2>${projetoEditando ? "Editar projeto" : "Novo projeto"}</h2>
            </div>
          </div>

          <form id="projetoForm" class="cronograma-form">
            <div class="cronograma-form-grid">
              <label class="cronograma-field">
                <span>Nome do projeto *</span>
                <input type="text" name="nome" value="${escapeHtml(projetoBase.nome)}" required />
              </label>

              <label class="cronograma-field">
                <span>Cliente</span>
                <input type="text" name="cliente" value="${escapeHtml(projetoBase.cliente)}" />
              </label>

              <label class="cronograma-field">
                <span>Nº da proposta</span>
                <input type="text" name="propostaNumero" value="${escapeHtml(projetoBase.propostaNumero)}" />
              </label>

              <label class="cronograma-field">
                <span>Responsável</span>
                <input type="text" name="responsavel" value="${escapeHtml(projetoBase.responsavel)}" />
              </label>

              <label class="cronograma-field">
                <span>Data de início</span>
                <input type="date" name="dataInicio" value="${escapeHtml(projetoBase.dataInicio)}" />
              </label>

              <label class="cronograma-field">
                <span>Prazo final</span>
                <input type="date" name="prazoFinal" value="${escapeHtml(projetoBase.prazoFinal)}" />
              </label>

              <label class="cronograma-field">
                <span>Status</span>
                <select name="status">
                  ${STATUS_OPTIONS.map(
                    (opt) =>
                      `<option value="${opt.value}" ${projetoBase.status === opt.value ? "selected" : ""}>${opt.label}</option>`
                  ).join("")}
                </select>
              </label>
            </div>

            <div class="cronograma-field">
              <span>Cor do projeto</span>
              <div class="cronograma-color-palette" id="colorPalette">
                ${CORES.map(
                  (cor) => `
                    <button
                      type="button"
                      class="cronograma-color-swatch ${projetoBase.cor === cor ? "is-selected" : ""}"
                      data-color="${cor}"
                      style="background:${cor}"
                      aria-label="Selecionar cor ${cor}"
                      title="${cor}"
                    ></button>
                  `
                ).join("")}
              </div>
              <input type="hidden" name="cor" id="projetoCor" value="${escapeHtml(projetoBase.cor)}" />
            </div>

            <label class="cronograma-field">
              <span>Descrição</span>
              <textarea name="descricao" rows="5">${escapeHtml(projetoBase.descricao)}</textarea>
            </label>

            <div class="cronograma-form-actions">
              <button class="cronograma-btn cronograma-btn--primary" type="submit">
                ${projetoEditando ? "Salvar alterações" : "Cadastrar projeto"}
              </button>

              ${
                projetoEditando
                  ? `<button class="cronograma-btn cronograma-btn--ghost" type="button" id="btnCancelarEdicaoProjeto">
                      Cancelar edição
                    </button>`
                  : ""
              }
            </div>

            <p class="cronograma-form-feedback" id="projetoFormFeedback"></p>
          </form>
        </section>

        <section class="cronograma-panel">
          <div class="cronograma-section-head cronograma-section-head--stack-mobile">
            <div>
              <p class="cronograma-section-head__eyebrow">Consulta</p>
              <h2>Projetos cadastrados</h2>
            </div>

            <div class="cronograma-filter-row">
              <label class="cronograma-field cronograma-field--compact">
                <span>Status</span>
                <select id="filtroStatusProjeto">
                  <option value="todos" ${state.filtroStatusProjeto === "todos" ? "selected" : ""}>Todos</option>
                  ${STATUS_OPTIONS.map(
                    (opt) =>
                      `<option value="${opt.value}" ${state.filtroStatusProjeto === opt.value ? "selected" : ""}>${opt.label}</option>`
                  ).join("")}
                </select>
              </label>

              <label class="cronograma-check">
                <input type="checkbox" id="mostrarArquivados" ${state.mostrarArquivados ? "checked" : ""} />
                <span>Mostrar arquivados</span>
              </label>
            </div>
          </div>

          ${
            !state.projetosLoaded
              ? `<div class="cronograma-empty-state">Carregando projetos...</div>`
              : projetos.length
                ? `<div class="cronograma-project-list">${projetos.map(renderProjetoCard).join("")}</div>`
                : `<div class="cronograma-empty-state">Nenhum projeto encontrado com os filtros atuais.</div>`
          }
        </section>
      </div>
    </section>
  `;
}

function mountProjetosEvents() {
  const form = document.getElementById("projetoForm");
  const feedback = document.getElementById("projetoFormFeedback");
  const colorInput = document.getElementById("projetoCor");
  const btnCancelar = document.getElementById("btnCancelarEdicaoProjeto");
  const filtroStatus = document.getElementById("filtroStatusProjeto");
  const mostrarArquivados = document.getElementById("mostrarArquivados");

  document.querySelectorAll(".cronograma-color-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedColor = btn.dataset.color || "#0b2e1b";
      if (colorInput) colorInput.value = selectedColor;

      document.querySelectorAll(".cronograma-color-swatch").forEach((item) => {
        item.classList.toggle("is-selected", item.dataset.color === selectedColor);
      });
    });
  });

  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      setProjetoEditandoId(null);
      renderProjetosView();
    });
  }

  if (filtroStatus) {
    filtroStatus.addEventListener("change", (event) => {
      setFiltroStatusProjeto(event.target.value);
      renderProjetosView();
    });
  }

  if (mostrarArquivados) {
    mostrarArquivados.addEventListener("change", (event) => {
      setMostrarArquivados(event.target.checked);
      renderProjetosView();
    });
  }

  document.querySelectorAll('[data-action="editar-projeto"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      setProjetoEditandoId(btn.dataset.id);
      renderProjetosView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll('[data-action="arquivar-projeto"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = window.confirm("Arquivar este projeto? Ele continuará disponível para consulta.");
      if (!ok) return;

      try {
        await arquivarProjeto(btn.dataset.id);
      } catch (error) {
        console.error(error);
        window.alert(error.message || "Não foi possível arquivar o projeto.");
      }
    });
  });

  document.querySelectorAll('[data-action="desarquivar-projeto"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await desarquivarProjeto(btn.dataset.id);
      } catch (error) {
        console.error(error);
        window.alert(error.message || "Não foi possível desarquivar o projeto.");
      }
    });
  });

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const payload = {
        nome: formData.get("nome"),
        cliente: formData.get("cliente"),
        propostaNumero: formData.get("propostaNumero"),
        responsavel: formData.get("responsavel"),
        dataInicio: formData.get("dataInicio"),
        prazoFinal: formData.get("prazoFinal"),
        status: formData.get("status"),
        cor: formData.get("cor"),
        descricao: formData.get("descricao")
      };

      if (feedback) {
        feedback.textContent = "Salvando projeto...";
        feedback.classList.remove("is-error", "is-success");
      }

      try {
        if (state.projetoEditandoId) {
          await atualizarProjeto(state.projetoEditandoId, payload);
          setProjetoEditandoId(null);
          if (feedback) {
            feedback.textContent = "Projeto atualizado com sucesso.";
            feedback.classList.add("is-success");
          }
        } else {
          await criarProjeto(payload);
          form.reset();
          const corPadrao = "#0b2e1b";
          if (colorInput) colorInput.value = corPadrao;
          document.querySelectorAll(".cronograma-color-swatch").forEach((item) => {
            item.classList.toggle("is-selected", item.dataset.color === corPadrao);
          });

          if (feedback) {
            feedback.textContent = "Projeto cadastrado com sucesso.";
            feedback.classList.add("is-success");
          }
        }
      } catch (error) {
        console.error(error);
        if (feedback) {
          feedback.textContent = error.message || "Não foi possível salvar o projeto.";
          feedback.classList.add("is-error");
        }
      }
    });
  }
}

function ensureProjetosListener() {
  if (unsubscribeProjetos) return;

  unsubscribeProjetos = listenProjetos(
    (items) => {
      setProjetos(items);

      if (state.currentView === "projetos") {
        renderProjetosView();
      }
    },
    (error) => {
      console.error(error);
      setProjetos([]);
      if (state.currentView === "projetos") {
        renderIntoApp(`
          <section class="cronograma-panel">
            <div class="cronograma-empty-state cronograma-empty-state--error">
              Não foi possível carregar os projetos no Firestore.
            </div>
          </section>
        `);
      }
    }
  );
}

export function renderProjetosView() {
  ensureProjetosListener();
  renderIntoApp(getProjetosTemplate());
  mountProjetosEvents();
}
