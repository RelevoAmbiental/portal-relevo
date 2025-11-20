// =======================================
// INVENTÁRIO – Edição de Equipamentos
// =======================================

(function () {
  // Serviços Firebase vindos do guard do portal
  const auth = window.__RELEVO_AUTH__ || (window.firebase && firebase.auth());
  const db = window.__RELEVO_DB__ || (window.firebase && firebase.firestore());
  const storage = window.__RELEVO_STORAGE__ || (window.firebase && firebase.storage());

  if (!auth || !db || !storage) {
    console.error("❌ Inventário Edição: Firebase não inicializado corretamente.");
    alert("Erro ao inicializar o módulo de edição. Tente recarregar a página.");
    return;
  }

  const COLECAO = "inventario";

  // Estado em memória
  let equipamentos = [];
  let equipamentoSelecionado = null; // doc completo usado no modal

  // Referências DOM – lista
  const tbody = document.getElementById("tbody-equipamentos-edit");
  const filtroCategoria = document.getElementById("filtro-categoria-edit");
  const filtroStatus = document.getElementById("filtro-status-edit");
  const filtroCodigo = document.getElementById("filtro-codigo-edit");
  const filtroNome = document.getElementById("filtro-nome-edit");
  const statusListaEl = document.getElementById("status-lista-edicao");

  // Referências DOM – modal
  const modal = document.getElementById("modal-edicao");
  const btnFecharModal = document.getElementById("btn-fechar-modal");
  const btnCancelarEdicao = document.getElementById("btn-cancelar-edicao");
  const btnSalvarEdicao = document.getElementById("btn-salvar-edicao");
  const btnExcluirItem = document.getElementById("btn-excluir-item");
  const statusEdicaoEl = document.getElementById("status-edicao");

  const formEdicao = document.getElementById("form-edicao");
  const inputId = document.getElementById("edit-id");
  const inputCodigoInterno = document.getElementById("edit-codigoInterno");
  const selectCategoria = document.getElementById("edit-categoria");
  const grupoCategoriaOutro = document.getElementById("edit-grupo-categoria-outro");
  const inputCategoriaOutro = document.getElementById("edit-categoriaOutro");
  const inputNome = document.getElementById("edit-nome");
  const selectStatus = document.getElementById("edit-status");
  const inputQtd = document.getElementById("edit-quantidadeTotal");
  const inputObs = document.getElementById("edit-observacoes");
  const inputDescricao = document.getElementById("edit-descricao");
  const inputFoto = document.getElementById("edit-foto");
  const fotoPreview = document.getElementById("edit-foto-preview");
  const fotoPreviewWrapper = document.getElementById("edit-foto-preview-wrapper");

  // Helpers
  function formatarData(timestamp) {
    if (!timestamp) return "";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  function abrirModal() {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function fecharModal() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    equipamentoSelecionado = null;
    formEdicao.reset();
    inputId.value = "";
    inputCodigoInterno.value = "";
    inputCategoriaOutro.value = "";
    grupoCategoriaOutro.style.display = "none";
    if (fotoPreview) {
      fotoPreview.src = "";
      fotoPreviewWrapper.style.display = "none";
    }
    statusEdicaoEl.textContent = "";
  }

  function atualizarCategoriaOutroVisibilidade() {
    if (selectCategoria.value === "Outros") {
      grupoCategoriaOutro.style.display = "block";
    } else {
      grupoCategoriaOutro.style.display = "none";
      inputCategoriaOutro.value = "";
    }
  }

  function getCategoriaFinal(categoriaBase, categoriaOutroTexto) {
    if (categoriaBase === "Outros") {
      const outro = (categoriaOutroTexto || "").trim();
      return outro || "Outros";
    }
    return categoriaBase;
  }

  function aplicarFiltros(lista) {
    const cat = filtroCategoria.value;
    const st = filtroStatus.value;
    const cod = (filtroCodigo.value || "").trim().toLowerCase();
    const nome = (filtroNome.value || "").trim().toLowerCase();

    return lista.filter((eq) => {
      if (cat && eq.categoriaBase === "Outros" && cat === "Outros") {
        // ok
      } else if (cat && eq.categoriaBase !== cat && eq.categoria !== cat) {
        return false;
      }

      if (st && eq.status !== st) return false;

      if (cod && !(eq.codigoInterno || "").toLowerCase().includes(cod)) {
        return false;
      }

      if (nome && !(eq.nome || "").toLowerCase().includes(nome)) {
        return false;
      }

      return true;
    });
  }

  function renderTabela() {
    const filtrados = aplicarFiltros(equipamentos);
    tbody.innerHTML = "";

    if (!filtrados.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.textContent = "Nenhum equipamento encontrado com os filtros atuais.";
      td.style.textAlign = "center";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtrados.forEach((eq) => {
      const tr = document.createElement("tr");

      const tdCodigo = document.createElement("td");
      tdCodigo.textContent = eq.codigoInterno || "-";

      const tdNome = document.createElement("td");
      tdNome.textContent = eq.nome || "-";

      const tdCategoria = document.createElement("td");
      tdCategoria.textContent = eq.categoria || "-";

      const tdStatus = document.createElement("td");
      const spanStatus = document.createElement("span");
      spanStatus.classList.add("status-badge");
      spanStatus.textContent = eq.status || "-";
      switch (eq.status) {
        case "disponivel":
          spanStatus.classList.add("status-disponivel");
          spanStatus.textContent = "Disponível";
          break;
        case "emprestado":
          spanStatus.classList.add("status-emprestado");
          spanStatus.textContent = "Emprestado";
          break;
        case "manutencao":
          spanStatus.classList.add("status-manutencao");
          spanStatus.textContent = "Manutenção";
          break;
        case "perdido":
          spanStatus.classList.add("status-perdido");
          spanStatus.textContent = "Perdido";
          break;
        default:
          break;
      }
      tdStatus.appendChild(spanStatus);

      const tdFoto = document.createElement("td");
      if (eq.fotoURL) {
        const img = document.createElement("img");
        img.src = eq.fotoURL;
        img.alt = eq.nome || "Foto do equipamento";
        img.className = "equip-img-thumb";
        tdFoto.appendChild(img);
      } else {
        tdFoto.textContent = "-";
      }

      const tdCriado = document.createElement("td");
      tdCriado.textContent = formatarData(eq.criadoEm);

      const tdAcoes = document.createElement("td");
      tdAcoes.classList.add("td-acoes");

      const btnEditar = document.createElement("button");
      btnEditar.className = "btn-icon";
      btnEditar.title = "Editar";
      btnEditar.dataset.id = eq.id;
      btnEditar.innerHTML = '<i class="fas fa-edit"></i>';

      const btnExcluir = document.createElement("button");
      btnExcluir.className = "btn-icon btn-icon-danger";
      btnExcluir.title = "Excluir";
      btnExcluir.dataset.id = eq.id;
      btnExcluir.innerHTML = '<i class="fas fa-trash"></i>';

      tdAcoes.appendChild(btnEditar);
      tdAcoes.appendChild(btnExcluir);

      tr.appendChild(tdCodigo);
      tr.appendChild(tdNome);
      tr.appendChild(tdCategoria);
      tr.appendChild(tdStatus);
      tr.appendChild(tdFoto);
      tr.appendChild(tdCriado);
      tr.appendChild(tdAcoes);

      tbody.appendChild(tr);
    });
  }

  // Carrega docs em tempo real
  function iniciarSnapshot() {
    statusListaEl.textContent = "Carregando equipamentos...";

    db.collection(COLECAO).orderBy("criadoEm", "desc").onSnapshot(
      (snap) => {
        equipamentos = [];
        snap.forEach((doc) => {
          const data = doc.data();
          equipamentos.push({
            id: doc.id,
            nome: data.nome || "",
            categoria: data.categoria || "",
            categoriaBase: data.categoriaBase || data.categoria || "",
            codigoInterno: data.codigoInterno || "",
            status: data.status || "",
            descricao: data.descricao || "",
            observacoes: data.observacoes || "",
            quantidadeTotal: typeof data.quantidadeTotal === "number" ? data.quantidadeTotal : null,
            fotoURL: data.fotoURL || "",
            criadoEm: data.criadoEm || null
          });
        });

        statusListaEl.textContent = equipamentos.length
          ? `Total de itens carregados: ${equipamentos.length}`
          : "Nenhum item cadastrado no inventário.";
        renderTabela();
      },
      (err) => {
        console.error("❌ Erro ao carregar inventário:", err);
        statusListaEl.textContent = "Erro ao carregar inventário. Tente novamente mais tarde.";
      }
    );
  }

  // Preenche modal com dados do item selecionado
  function preencherModal(eq) {
    equipamentoSelecionado = eq;

    inputId.value = eq.id;
    inputCodigoInterno.value = eq.codigoInterno || "";
    inputNome.value = eq.nome || "";
    selectStatus.value = eq.status || "disponivel";
    inputQtd.value = eq.quantidadeTotal != null ? String(eq.quantidadeTotal) : "";
    inputDescricao.value = eq.descricao || "";
    inputObs.value = eq.observacoes || "";

    // Categoria base e final
    // Se categoriaBase não existir, tentamos inferir pela categoria salvo
    let categoriaBase = eq.categoriaBase || eq.categoria || "";
    let categoriaOutroTexto = "";

    const opcoesFixas = [
      "EPI e Segurança",
      "Iluminação",
      "Espeleologia",
      "Progressão Vertical",
      "Topografia e Medição",
      "Registro e Documentação",
      "Coleta e Amostragem Ambiental",
      "Acessórios e Logística",
      "Comunicação",
      "Outros"
    ];

    if (!opcoesFixas.includes(categoriaBase) && eq.categoria) {
      // Categoria registrada que não é uma das fixas -> tratamos como "Outros" + texto
      categoriaOutroTexto = eq.categoria;
      categoriaBase = "Outros";
    } else if (categoriaBase === "Outros") {
      categoriaOutroTexto = eq.categoria && eq.categoria !== "Outros" ? eq.categoria : "";
    }

    selectCategoria.value = categoriaBase || "";
    inputCategoriaOutro.value = categoriaOutroTexto;
    atualizarCategoriaOutroVisibilidade();

    // Foto
    if (eq.fotoURL) {
      fotoPreview.src = eq.fotoURL;
      fotoPreviewWrapper.style.display = "block";
    } else {
      fotoPreview.src = "";
      fotoPreviewWrapper.style.display = "none";
    }

    statusEdicaoEl.textContent = "";
  }

  // Eventos – filtros
  [filtroCategoria, filtroStatus].forEach((el) =>
    el.addEventListener("change", () => renderTabela())
  );
  [filtroCodigo, filtroNome].forEach((el) =>
    el.addEventListener("input", () => renderTabela())
  );

  // Evento – abrir modal ao clicar em editar
  tbody.addEventListener("click", (e) => {
    const btnEditar = e.target.closest(".btn-icon:not(.btn-icon-danger)");
    const btnExcluir = e.target.closest(".btn-icon-danger");

    if (btnEditar) {
      const id = btnEditar.dataset.id;
      const eq = equipamentos.find((item) => item.id === id);
      if (!eq) return;
      preencherModal(eq);
      abrirModal();
      return;
    }

    if (btnExcluir) {
      const id = btnExcluir.dataset.id;
      const eq = equipamentos.find((item) => item.id === id);
      if (!eq) return;
      confirmarExclusao(eq);
      return;
    }
  });

  // Categoria "Outros" dentro do modal
  selectCategoria.addEventListener("change", atualizarCategoriaOutroVisibilidade);

  // Botões do modal
  btnFecharModal.addEventListener("click", fecharModal);
  btnCancelarEdicao.addEventListener("click", fecharModal);

  // Confirmar exclusão
  async function confirmarExclusao(eq) {
    const ok = confirm(
      `Tem certeza que deseja excluir o item:\n\n` +
      `Código: ${eq.codigoInterno || "-"}\n` +
      `Nome: ${eq.nome || "-"}\n\n` +
      `Esta ação não poderá ser desfeita.`
    );
    if (!ok) return;

    statusListaEl.textContent = "Excluindo item...";
    try {
      // Se tiver foto, tenta apagar também
      if (eq.fotoURL) {
        try {
          const refFromUrl = storage.refFromURL(eq.fotoURL);
          await refFromUrl.delete();
        } catch (errFoto) {
          console.warn("⚠️ Não foi possível excluir a foto do Storage:", errFoto);
        }
      }

      await db.collection(COLECAO).doc(eq.id).delete();
      statusListaEl.textContent = "Item excluído com sucesso.";
      setTimeout(() => (statusListaEl.textContent = ""), 3000);
    } catch (err) {
      console.error("❌ Erro ao excluir item:", err);
      statusListaEl.textContent = "Erro ao excluir item. Tente novamente.";
    }
  }

  // Submit de edição
  formEdicao.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!equipamentoSelecionado) return;

    const id = inputId.value;
    const nome = inputNome.value.trim();
    const categoriaBase = selectCategoria.value;
    const categoriaOutroTexto = inputCategoriaOutro.value;
    const statusNovo = selectStatus.value;
    const qtdStr = inputQtd.value.trim();
    const quantidadeTotal = qtdStr ? parseInt(qtdStr, 10) : null;
    const descricao = inputDescricao.value.trim();
    const observacoes = inputObs.value.trim();
    const novaFoto = inputFoto.files[0] || null;

    if (!nome || !categoriaBase || !statusNovo) {
      statusEdicaoEl.textContent = "Preencha pelo menos nome, categoria e status.";
      return;
    }

    const categoriaFinal = getCategoriaFinal(categoriaBase, categoriaOutroTexto);

    statusEdicaoEl.textContent = "Salvando alterações...";
    btnSalvarEdicao.disabled = true;

    try {
      const payload = {
        nome,
        categoria: categoriaFinal,
        categoriaBase,
        status: statusNovo,
        descricao,
        observacoes,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (quantidadeTotal !== null && !Number.isNaN(quantidadeTotal)) {
        payload.quantidadeTotal = quantidadeTotal;
      }

      let novaFotoURL = null;
      let fotoAntigaURL = equipamentoSelecionado.fotoURL || "";

      if (novaFoto) {
        const storageRef = storage.ref().child(`inventario/${id}_${novaFoto.name}`);
        await storageRef.put(novaFoto);
        novaFotoURL = await storageRef.getDownloadURL();
        payload.fotoURL = novaFotoURL;
      }

      await db.collection(COLECAO).doc(id).update(payload);

      // Se trocou de foto, tenta apagar a antiga
      if (novaFotoURL && fotoAntigaURL) {
        try {
          const refOld = storage.refFromURL(fotoAntigaURL);
          await refOld.delete();
        } catch (errOld) {
          console.warn("⚠️ Não foi possível apagar a foto anterior:", errOld);
        }
      }

      statusEdicaoEl.textContent = "Alterações salvas com sucesso.";
      setTimeout(() => {
        statusEdicaoEl.textContent = "";
        fecharModal();
      }, 1200);
    } catch (err) {
      console.error("❌ Erro ao salvar alterações:", err);
      statusEdicaoEl.textContent = "Erro ao salvar. Tente novamente.";
    } finally {
      btnSalvarEdicao.disabled = false;
    }
  });

  // Exclusão pelo botão dentro do modal
  btnExcluirItem.addEventListener("click", () => {
    if (!equipamentoSelecionado) return;
    confirmarExclusao(equipamentoSelecionado);
    fecharModal();
  });

  // Autenticação – garantia que só usuários logados conseguem acessar
  auth.onAuthStateChanged((user) => {
    if (!user) {
      console.log("❌ Inventário Edição: usuário não autenticado. Redirecionando...");
      window.location.href = "../index.html";
      return;
    }
    console.log("✅ Inventário Edição: usuário autenticado:", user.email);
    iniciarSnapshot();
  });
})();
