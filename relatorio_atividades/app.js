/* =========================================================
   Relatório Diário de Atividades — Portal Relevo
   - Usa Firebase compat já inicializado pelo portal
   - ✅ Agora exige login (sem modo público)
   ========================================================= */

(function () {
  "use strict";

  // --------- Listas (iguais às do Despesas) ---------
  const FUNCIONARIOS = [
    "Samuel",
    "Tiago",
    "Gleysson",
    "Gerly",
    "Henever",
    "Roberto Aquino"
  ];

  const PROJETOS = [
    "ADM Geral",
    "Grande Sertão 1",
    "BR-135/BA",
    "RIALMA"
  ];

  const ATIVIDADES = [
    "deslocamento",
    "Campo diurno",
    "Campo noturno",
    "Escritório",
    "Folga",
    "Manutenção de equipamentos",
    "Treinamento",
    "Outro (descrever nas observações)"
  ];

  const COLLECTION = "relatorios_atividades";
  const DEFAULT_LIMIT = 10;
  const MAX_FETCH_CAP = 1000; // segurança

  // ✅ Estado apenas da aba [Relatórios]
  const relatoriosState = {
    fetched: [],   // itens buscados do Firestore (janela recente)
    filtered: []   // itens após filtro + limite (o que está na tela e vai pro CSV)
  };

  // ✅ Estado de edição (para corrigir/editar sem duplicar)
  let __EDIT_ID__ = null;
  let __EDIT_OWNER_UID__ = null; // uid do dono do relatório em edição

  function isEditing() {
    return !!__EDIT_ID__;
  }

  function setEditing(id, ownerUid) {
    __EDIT_ID__ = id || null;
    __EDIT_OWNER_UID__ = ownerUid || null;

    const btn = $("#btnSalvar");
    if (btn) btn.textContent = __EDIT_ID__ ? "Atualizar" : "Salvar";

    // feedback visual simples (sem mexer em CSS global)
    const st = $("#statusMsg");
    if (st && __EDIT_ID__) {
      st.textContent = "Modo edição: você está atualizando um relatório existente.";
      st.style.color = "#0f4d2e";
    }
  }

  function clearEditing() {
    setEditing(null, null);
  }

  function canEditItem(it) {
    const user = getPortalUser();
    if (!user || !user.uid) return false;
    if (__USER_TIPO__ === "gestao") return true;
    return (__USER_TIPO__ === "colaborador") && (it && it.createdByUid === user.uid);
  }

  function canDeleteItem(it) {
    // ✅ decisão: colaborador pode apagar o próprio
    return canEditItem(it);
  }


  // ✅ Perfil do usuário (gestao/colaborador/cliente) carregado do Firestore (/users/{uid})
  let __USER_TIPO__ = "colaborador"; // default seguro: restringe (melhor negar demais do que expor)
  let __USER_TIPO_READY__ = false;

  async function carregarUserTipo() {
    const db = getFirestore();
    const user = getPortalUser();
    if (!db || !user || !user.uid) {
      __USER_TIPO__ = "colaborador";
      __USER_TIPO_READY__ = true;
      return __USER_TIPO__;
    }

    try {
      // coleção do portal: /users/{uid} com campo "tipo"
      const doc = await db.collection("users").doc(user.uid).get();
      const data = doc && doc.exists ? doc.data() : null;

      const tipo = (data && (data.tipo || data.role || data.perfil)) ? String(data.tipo || data.role || data.perfil) : "";
      __USER_TIPO__ = (tipo || "colaborador").toLowerCase();
    } catch (e) {
      // fallback seguro
      __USER_TIPO__ = "colaborador";
    } finally {
      __USER_TIPO_READY__ = true;
    }

    return __USER_TIPO__;
  }


  // --------- Helpers DOM ---------
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function setStatus(msg, ok) {
    const el = $("#statusMsg");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = ok === false ? "#8b1f1f" : "#0f4d2e";
  }

  function fillSelect(selectEl, values, placeholder) {
    if (!selectEl) return;

    selectEl.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder || "Selecione...";
    opt0.disabled = true;
    opt0.selected = true;
    selectEl.appendChild(opt0);

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    }
  }

  // ✅ select de filtro (permite "Todos" selecionável)
  function fillFilterSelect(selectEl, values, allLabel) {
    if (!selectEl) return;

    selectEl.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = allLabel || "Todos";
    optAll.selected = true;
    selectEl.appendChild(optAll);

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    }
  }

  function isoToday() {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function brDate(iso) {
    if (!iso) return "—";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --------- Firebase access (portal) ---------
  function getFirestore() {
    if (window.__RELEVO_DB__) return window.__RELEVO_DB__;
    if (window.db) return window.db;
    if (window.firebase && window.firebase.firestore) return window.firebase.firestore();
    return null;
  }

  function getPortalAuth() {
    try {
      return window.__RELEVO_AUTH__ || (window.firebase && window.firebase.auth && window.firebase.auth()) || null;
    } catch (e) {
      return null;
    }
  }

  function getPortalUser() {
    const u = window.__RELEVO_USER__ || null;
    if (u && (u.uid || u.email)) return u;

    try {
      const auth = getPortalAuth();
      const cu = auth && auth.currentUser;
      if (cu) return { uid: cu.uid, email: cu.email || "", displayName: cu.displayName || "" };
    } catch (e) {}

    return null;
  }

  function serverTimestamp() {
    try {
      if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
        return window.firebase.firestore.FieldValue.serverTimestamp();
      }
    } catch (e) {}
    return new Date();
  }

  // ✅ Exige login (sem modo público)
  function ensureLoginOrRedirect() {
    const auth = getPortalAuth();
    if (!auth || !auth.onAuthStateChanged) {
      setStatus("Auth do Portal não disponível. Abra pelo Portal Relevo.", false);
      // não redireciona agressivamente aqui porque pode estar carregando scripts ainda
      return;
    }

    setStatus("Verificando login…", true);

    auth.onAuthStateChanged(function (u) {
      if (!u) {
        setStatus("Você precisa estar logado para usar o Relatório. Redirecionando…", false);
        setTimeout(function () {
          window.location.href = "/index.html";
        }, 700);
        return;
      }

      // ✅ usuário logado: segue o boot normal
      const badge = $("#userBadge");
      if (badge) badge.textContent = u.email || u.displayName || "Usuário logado";

      bootComUsuario();
    });
  }

  // --------- Tabs (blindadas) ---------
  function setTab(tabName) {
    const btns = $all(".tab-btn[data-tab]");
    const panels = $all(".tab-panel[data-panel]");
    if (!btns.length || !panels.length) return;

    btns.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === tabName);
    });

    panels.forEach(function (p) {
      p.classList.toggle("hidden", p.getAttribute("data-panel") !== tabName);
    });
  }

  // --------- Listagem ---------
  function renderLista(items) {
    const lista = $("#listaRelatorios");
    if (!lista) return;

    if (!items.length) {
      lista.innerHTML =
        '<div class="item">' +
          '<div style="font-weight:900;">Nenhum registro encontrado.</div>' +
          '<div class="muted">Ajuste os filtros ou aumente a quantidade.</div>' +
        "</div>";
      return;
    }

    let html = "";
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const ok = !!it.objetivoAlcancado;
      const badgeClass = ok ? "badge ok" : "badge nok";
      const badgeTxt = ok ? "Objetivo: SIM" : "Objetivo: NÃO";

      // ✅ Exibe funcionário + projeto + data + atividade
      const funcionario = escapeHtml(it.funcionario || "—");
      const projeto = escapeHtml(it.projeto || "—");
      const dataTxt = escapeHtml(brDate(it.data));
      const atividade = escapeHtml(it.atividade || "—");

      const linha1 = funcionario + " • " + projeto;
      const linha2 = dataTxt + " • " + atividade;

      const desc = it.descricao ? '<div style="margin-top:8px; font-weight:700;">' + escapeHtml(it.descricao) + "</div>" : "";
      const obs = it.observacao ? '<div style="margin-top:6px;" class="muted">' + escapeHtml(it.observacao) + "</div>" : "";

      html +=
        '<div class="item">' +
          '<div class="row">' +
            '<div>' +
              '<div style="font-weight:900; color:#0b2e1b;">' + linha1 + "</div>" +
              '<div class="muted">' + linha2 + "</div>" +
            "</div>" +
'<div style="display:flex; gap:8px; align-items:center;">' +
  '<div class="' + badgeClass + '">' + badgeTxt + '</div>' +
  (function(){
    const user = getPortalUser();
    const uid = user && user.uid ? user.uid : "";
    const canEdit = (__USER_TIPO__ === "gestao") || (__USER_TIPO__ === "colaborador" && it.createdByUid === uid);
    const canDel  = canEdit; // colaborador pode apagar o próprio
    if (!canEdit && !canDel) return "";
    return '' +
      '<div style="display:flex; gap:6px; align-items:center;">' +
        (canEdit ? '<button class="ra-action ra-edit" data-id="' + escapeHtml(it.id) + '" type="button" title="Editar" ' +
          'style="border:1px solid #cbd5d1; background:#fff; color:#0b2e1b; padding:6px 10px; border-radius:10px; cursor:pointer; font-weight:800;">✏️</button>' : '') +
        (canDel ? '<button class="ra-action ra-del" data-id="' + escapeHtml(it.id) + '" type="button" title="Apagar" ' +
          'style="border:1px solid #e0b4b4; background:#fff; color:#8b1f1f; padding:6px 10px; border-radius:10px; cursor:pointer; font-weight:900;">🗑️</button>' : '') +
      '</div>';
  })() +
'</div>' +

          "</div>" +
          desc +
          obs +
        "</div>";
    }

    lista.innerHTML = html;
  }

  // ✅ Aplica filtros/limite somente na aba [Relatórios]
  function aplicarFiltrosELimite() {
    const funcionario = $("#filtroFuncionario") ? ($("#filtroFuncionario").value || "") : "";
    const projeto = $("#filtroProjeto") ? ($("#filtroProjeto").value || "") : "";
    const limite = $("#filtroLimite") ? parseInt($("#filtroLimite").value || String(DEFAULT_LIMIT), 10) : DEFAULT_LIMIT;

    let items = relatoriosState.fetched.slice();

    if (funcionario) items = items.filter(it => (it.funcionario || "") === funcionario);
    if (projeto) items = items.filter(it => (it.projeto || "") === projeto);

    // ordena no cliente por createdAt desc (segurança)
    items.sort(function (a, b) {
      const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });

    // corta para exibição
    const view = items.slice(0, Math.max(0, limite));
    relatoriosState.filtered = view;

    // KPIs passam a refletir o que está sendo exibido
    const total = view.length;
    let ok = 0;
    for (let i = 0; i < view.length; i++) if (view[i].objetivoAlcancado) ok++;
    const nok = total - ok;

    if ($("#kpiTotal")) $("#kpiTotal").textContent = String(total);
    if ($("#kpiOk")) $("#kpiOk").textContent = String(ok) + " / " + String(nok);

    renderLista(view);

    setStatus("Relatórios: " + total + " exibidos (logado).", true);
  }

  async function carregarMeusRelatorios() {
    const db = getFirestore();
    const user = getPortalUser();

    if (!db) { setStatus("Firestore não disponível no portal.", false); return; }
    if (!user || !user.uid) { setStatus("Sessão não encontrada. Faça login no Portal.", false); return; }

    // lê o limite desejado (para definir uma janela de busca maior e filtrar localmente)
    const limiteExibir = $("#filtroLimite")
      ? parseInt($("#filtroLimite").value || String(DEFAULT_LIMIT), 10)
      : DEFAULT_LIMIT;

    // buscamos uma janela maior que o limite, pra filtro funcionar sem “sumir”
    const fetchN = Math.min(MAX_FETCH_CAP, Math.max(200, limiteExibir * 20));

    if ($("#kpiTotal")) $("#kpiTotal").textContent = "…";
    if ($("#kpiOk")) $("#kpiOk").textContent = "…";
    setStatus("Carregando relatórios…", true);

    try {
      // ✅ Por enquanto carrega a janela recente (como estava)
      // (Depois a gente filtra por createdByUid no Firestore quando as rules apertarem)
      // ✅ Aplica controle por papel:
// - gestao: vê tudo (orderBy + limit)
// - demais: vê apenas os próprios (where createdByUid == uid)
// Observação: where + orderBy pode exigir índice composto; se faltar, fazemos fallback sem orderBy e ordenamos no cliente.
let snap;

// garante perfil carregado (não trava a UI)
if (!__USER_TIPO_READY__) {
  await carregarUserTipo();
}

if (__USER_TIPO__ === "gestao") {
  snap = await db.collection(COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(fetchN)
    .get();
} else {
  try {
    snap = await db.collection(COLLECTION)
      .where("createdByUid", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(fetchN)
      .get();
  } catch (e) {
    // fallback: evita quebra por índice composto
    console.warn("⚠️ Consulta com where+orderBy falhou (possível índice). Usando fallback sem orderBy.", e);
    snap = await db.collection(COLLECTION)
      .where("createdByUid", "==", user.uid)
      .limit(fetchN)
      .get();
  }
}

const items = snap.docs.map(function (d) {
        const data = d.data();
        data.id = d.id;
        return data;
      });

      relatoriosState.fetched = items;
      aplicarFiltrosELimite();
    } catch (err) {
      console.error("❌ Erro ao carregar relatórios:", err);
      setStatus("Erro ao carregar relatórios. Veja o console.", false);
    }
  }

  // --------- Export CSV (somente o que está exibido) ---------
  function csvEscape(value) {
    const s = String(value ?? "");
    // se tiver separador, aspas ou quebra de linha -> aspas + escape
    if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportarCsv() {
    const rows = relatoriosState.filtered || [];
    if (!rows.length) {
      alert("Não há dados para exportar com os filtros atuais.");
      return;
    }

    // Cabeçalho (mantém simples e útil)
    const header = [
      "Data",
      "Funcionario",
      "Projeto",
      "Atividade",
      "Descricao",
      "Observacao",
      "ObjetivoAlcancado"
    ];

    const lines = [];
    lines.push(header.join(";"));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = [
        csvEscape(r.data || ""),
        csvEscape(r.funcionario || ""),
        csvEscape(r.projeto || ""),
        csvEscape(r.atividade || ""),
        csvEscape(r.descricao || ""),
        csvEscape(r.observacao || ""),
        csvEscape(r.objetivoAlcancado ? "Sim" : "Nao")
      ];
      lines.push(line.join(";"));
    }

    // UTF-8 BOM + separador ; (PT-BR friendly)
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const fileName = "relatorios_atividades_" + yyyy + "-" + mm + "-" + dd + ".csv";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --------- Salvar ---------
  async function salvar(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();

    const db = getFirestore();
    const user = getPortalUser();

    if (!db) { setStatus("Firestore não disponível no portal.", false); return; }

    // ✅ trava: não salva sem login
    if (!user || !user.uid) {
      setStatus("Você precisa estar logado para salvar. Redirecionando…", false);
      setTimeout(function () { window.location.href = "/index.html"; }, 700);
      return;
    }

    const funcionario = $("#funcionario").value || "";
    const projeto = $("#projeto").value || "";
    const data = $("#data").value || "";
    const atividade = $("#atividade").value || "";

    const descricao = ($("#descricao").value || "").trim();
    const observacao = ($("#observacao").value || "").trim();

    const objetivoNode = document.querySelector('input[name="objetivo"]:checked');
    if (!objetivoNode) {
      alert("Selecione se o objetivo foi alcançado (Sim ou Não).");
      return;
    }
    const objetivoAlcancado = (objetivoNode.value === "sim");

    if (!funcionario || !projeto || !data || !atividade) {
      alert("Preencha Nome, Projeto, Data e Atividade.");
      return;
    }

    localStorage.setItem("ra_funcionario", funcionario);
    localStorage.setItem("ra_projeto", projeto);

    const payload = {
      funcionario: funcionario,
      projeto: projeto,
      data: data,
      atividade: atividade,
      descricao: descricao,
      observacao: observacao,
      objetivoAlcancado: objetivoAlcancado,
      createdAt: serverTimestamp(),
      createdByUid: user.uid,
      createdByEmail: user.email || null
    };

    const btn = $("#btnSalvar");
    if (btn) btn.disabled = true;
    setStatus("Salvando...");

    try {
if (isEditing()) {
  // ✅ Atualiza relatório existente (sem alterar autoria/data)
  const updatePayload = {
    funcionario: funcionario,
    projeto: projeto,
    data: data,
    atividade: atividade,
    descricao: descricao,
    observacao: observacao,
    objetivoAlcancado: objetivoAlcancado,
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
    updatedByEmail: user.email || null
  };

  await db.collection(COLLECTION).doc(__EDIT_ID__).update(updatePayload);
  setStatus("✅ Registro atualizado com sucesso.");

  // sai do modo edição
  clearEditing();
} else {
  await db.collection(COLLECTION).add(payload);
  setStatus("✅ Registro salvo com sucesso.");
}

      $("#descricao").value = "";
      $("#observacao").value = "";
      $all('input[name="objetivo"]').forEach(function (r) { r.checked = false; });

      setTab("meus");
      await carregarMeusRelatorios();
    } catch (err) {
      console.error("❌ Erro ao salvar:", err);
      setStatus("Erro ao salvar. Veja o console.", false);
      alert("Não foi possível salvar. Verifique conexão/permissões.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function limpar() {
    // ✅ Se estava em edição, limpar também cancela o modo edição
    if (isEditing()) {
      clearEditing();
    }

    // (mantém comportamento atual do seu projeto — não mexer aqui conforme pedido anterior)
    const selFunc = $("#funcionario");
    const selProj = $("#projeto");
    const selAtv = $("#atividade");
    const inpData = $("#data");

    if (selFunc) selFunc.selectedIndex = 0;
    if (selProj) selProj.selectedIndex = 0;
    if (selAtv) selAtv.selectedIndex = 0;

    if (inpData) inpData.value = isoToday();

    const desc = $("#descricao");
    const obs = $("#observacao");
    if (desc) desc.value = "";
    if (obs) obs.value = "";

    $all('input[name="objetivo"]').forEach(function (r) { r.checked = false; });

    localStorage.removeItem("ra_funcionario");
    localStorage.removeItem("ra_projeto");

    setStatus("");
  }

  // --------- Boot ---------
  function bootComUsuario() {
    // Popula selects (Novo relatório)
    fillSelect($("#funcionario"), FUNCIONARIOS, "Selecione seu nome...");
    fillSelect($("#projeto"), PROJETOS, "Selecione o projeto...");
    fillSelect($("#atividade"), ATIVIDADES, "Selecione...");

    // Data default
    if ($("#data")) $("#data").value = isoToday();

    // ✅ Carrega perfil do usuário (gestao/colaborador/cliente)
    // Não bloqueia a tela; a listagem aguarda quando necessário.
    carregarUserTipo();

    // Restore (Novo relatório)
    const savedFunc = localStorage.getItem("ra_funcionario");
    const savedProj = localStorage.getItem("ra_projeto");
    if (savedFunc && FUNCIONARIOS.indexOf(savedFunc) >= 0) $("#funcionario").value = savedFunc;
    if (savedProj && PROJETOS.indexOf(savedProj) >= 0) $("#projeto").value = savedProj;

    // ✅ Relatórios: preencher filtros (somente se os elementos existirem no HTML)
    fillFilterSelect($("#filtroFuncionario"), FUNCIONARIOS, "Todos os funcionários");
    fillFilterSelect($("#filtroProjeto"), PROJETOS, "Todos os projetos");
    if ($("#filtroLimite") && !$("#filtroLimite").value) $("#filtroLimite").value = String(DEFAULT_LIMIT);

    // ✅ Eventos dos filtros (não mexe na aba Novo relatório)
    if ($("#filtroFuncionario")) $("#filtroFuncionario").addEventListener("change", aplicarFiltrosELimite);
    if ($("#filtroProjeto")) $("#filtroProjeto").addEventListener("change", aplicarFiltrosELimite);
    if ($("#filtroLimite")) $("#filtroLimite").addEventListener("change", carregarMeusRelatorios);
    if ($("#btnExportarCsv")) $("#btnExportarCsv").addEventListener("click", exportarCsv);

    // ✅ Ações na lista (Editar / Apagar) — delegação de eventos
    const lista = $("#listaRelatorios");
    if (lista) {
      lista.addEventListener("click", async function (ev) {
        const t = ev.target;
        if (!t) return;

        const btn = t.closest ? t.closest("button.ra-action") : null;
        if (!btn) return;

        const id = btn.getAttribute("data-id");
        if (!id) return;

        // encontra item no estado atual
        const it = (relatoriosState.fetched || []).find(function (x) { return x && x.id === id; });
        if (!it) {
          alert("Não foi possível localizar esse relatório na memória. Recarregue a lista.");
          return;
        }

        if (btn.classList.contains("ra-edit")) {
          if (!canEditItem(it)) {
            alert("Você não tem permissão para editar este relatório.");
            return;
          }

          // entra em modo edição e preenche formulário
          setEditing(id, it.createdByUid);

          // preenche campos
          if ($("#funcionario")) $("#funcionario").value = it.funcionario || "";
          if ($("#projeto")) $("#projeto").value = it.projeto || "";
          if ($("#data")) $("#data").value = it.data || isoToday();
          if ($("#atividade")) $("#atividade").value = it.atividade || "";

          if ($("#descricao")) $("#descricao").value = it.descricao || "";
          if ($("#observacao")) $("#observacao").value = it.observacao || "";

          // objetivo
          $all('input[name="objetivo"]').forEach(function (r) { r.checked = false; });
          const objetivo = it.objetivoAlcancado ? "sim" : "nao";
          const radio = document.querySelector('input[name="objetivo"][value="' + objetivo + '"]');
          if (radio) radio.checked = true;

          // vai para aba novo (reutiliza o formulário)
          setTab("novo");
          setStatus("Modo edição ativado. Ajuste o formulário e clique em Atualizar.", true);
          return;
        }

        if (btn.classList.contains("ra-del")) {
          if (!canDeleteItem(it)) {
            alert("Você não tem permissão para apagar este relatório.");
            return;
          }

          const resumo = (it.funcionario || "—") + " • " + (it.projeto || "—") + " • " + brDate(it.data);
          const ok = confirm(
            "Apagar este relatório?\n\n" +
            resumo +
            "\n\nEssa ação não pode ser desfeita."
          );
          if (!ok) return;

          try {
            const db = getFirestore();
            await db.collection(COLLECTION).doc(id).delete();

            // se estava editando este mesmo item, sai do modo edição
            if (__EDIT_ID__ === id) {
              clearEditing();
            }

            setStatus("✅ Relatório apagado.", true);
            await carregarMeusRelatorios();
          } catch (e) {
            console.error("❌ Erro ao apagar relatório:", e);
            alert("Não foi possível apagar. Verifique permissões/conexão.");
          }
          return;
        }
      });
    }



    // Tabs
    $all(".tab-btn[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const tab = btn.getAttribute("data-tab");
        setTab(tab);
        if (tab === "meus") carregarMeusRelatorios();
      });
    });

    // Actions (Novo relatório + recarregar)
    if ($("#formRelatorio")) $("#formRelatorio").addEventListener("submit", salvar);
    if ($("#btnLimpar")) $("#btnLimpar").addEventListener("click", limpar);
    if ($("#btnRecarregar")) $("#btnRecarregar").addEventListener("click", carregarMeusRelatorios);

    // PWA SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js")
        .then(function () { console.log("✅ SW registrado (Relatório Atividades)"); })
        .catch(function (e) { console.warn("⚠️ Falha ao registrar SW:", e); });
    }

    setTab("novo");
    setStatus("");
  }

  function init() {
    // ✅ Exige login (isso chama bootComUsuario quando autenticar)
    ensureLoginOrRedirect();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
