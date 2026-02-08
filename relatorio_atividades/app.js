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
  const MAX_FETCH_CAP = 1000; 

  const relatoriosState = {
    fetched: [],   
    filtered: []   
  };

  let __EDIT_ID__ = null;
  let __EDIT_OWNER_UID__ = null; 

  function isEditing() {
    return !!__EDIT_ID__;
  }

  function setEditing(id, ownerUid) {
    __EDIT_ID__ = id || null;
    __EDIT_OWNER_UID__ = ownerUid || null;

    const btn = $("#btnSalvar");
    if (btn) btn.textContent = __EDIT_ID__ ? "Atualizar" : "Salvar";

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
    return canEditItem(it);
  }

  let __USER_TIPO__ = "colaborador"; 
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
      const doc = await db.collection("users").doc(user.uid).get();
      const data = doc && doc.exists ? doc.data() : null;
      const tipo = (data && (data.tipo || data.role || data.perfil)) ? String(data.tipo || data.role || data.perfil) : "";
      __USER_TIPO__ = (tipo || "colaborador").toLowerCase();
    } catch (e) {
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
    return d.toISOString().split('T')[0];
  }

  function brDate(iso) {
    if (!iso) return "—";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m]));
  }

  // --------- Firebase access ---------
  function getFirestore() {
    return window.__RELEVO_DB__ || window.db || (window.firebase && window.firebase.firestore && window.firebase.firestore()) || null;
  }

  function getPortalAuth() {
    return window.__RELEVO_AUTH__ || (window.firebase && window.firebase.auth && window.firebase.auth()) || null;
  }

  function getPortalUser() {
    const u = window.__RELEVO_USER__;
    if (u && u.uid) return u;
    const auth = getPortalAuth();
    const cu = auth && auth.currentUser;
    return cu ? { uid: cu.uid, email: cu.email || "" } : null;
  }

  function serverTimestamp() {
    try {
      return firebase.firestore.FieldValue.serverTimestamp();
    } catch (e) { return new Date(); }
  }

  function ensureLoginOrRedirect() {
    const auth = getPortalAuth();
    if (!auth) return;
    auth.onAuthStateChanged(function (u) {
      if (!u) {
        window.location.href = "/index.html";
      } else {
        const badge = $("#userBadge");
        if (badge) badge.textContent = u.email || "Usuário logado";
        bootComUsuario();
      }
    });
  }

  function setTab(tabName) {
    $all(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
    $all(".tab-panel").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== tabName));
  }

  // --------- Listagem (CORRIGIDA NA LINHA 317) ---------
  function renderLista(items) {
    const lista = $("#listaRelatorios");
    if (!lista) return;

    if (!items.length) {
      lista.innerHTML = '<div class="item"><div style="font-weight:900;">Nenhum registro encontrado.</div></div>';
      return;
    }

    let html = "";
    const user = getPortalUser();
    const uid = user ? user.uid : "";

    items.forEach(it => {
      const ok = !!it.objetivoAlcancado;
      const badgeClass = ok ? "badge ok" : "badge nok";
      const badgeTxt = ok ? "Objetivo: SIM" : "Objetivo: NÃO";

      const canEdit = (__USER_TIPO__ === "gestao") || (it.createdByUid === uid);

      // CORREÇÃO DA SINTAXE DE CONCATENAÇÃO
      html += '<div class="item">' +
                '<div class="row" style="display:flex; justify-content:space-between; align-items:center;">' +
                  '<div>' +
                    '<div style="font-weight:900; color:#0b2e1b;">' + escapeHtml(it.funcionario) + ' • ' + escapeHtml(it.projeto) + '</div>' +
                    '<div class="muted">' + brDate(it.data) + ' • ' + escapeHtml(it.atividade) + '</div>' +
                  '</div>' +
                  '<div style="display:flex; gap:8px; align-items:center;">' +
                    '<div class="' + badgeClass + '">' + badgeTxt + '</div>' +
                    (canEdit ? 
                      '<div style="display:flex; gap:6px;">' +
                        '<button class="ra-action ra-edit" data-id="' + it.id + '" style="border:1px solid #cbd5d1; background:#fff; padding:6px 10px; border-radius:10px; cursor:pointer;">✏️</button>' +
                        '<button class="ra-action ra-del" data-id="' + it.id + '" style="border:1px solid #e0b4b4; background:#fff; color:#8b1f1f; padding:6px 10px; border-radius:10px; cursor:pointer;">🗑️</button>' +
                      '</div>' : '') +
                  '</div>' +
                '</div>' +
                (it.descricao ? '<div style="margin-top:8px; font-weight:700;">' + escapeHtml(it.descricao) + '</div>' : '') +
                (it.observacao ? '<div style="margin-top:6px;" class="muted">' + escapeHtml(it.observacao) + '</div>' : '') +
              '</div>';
    });

    lista.innerHTML = html;
  }

  function aplicarFiltrosELimite() {
    const fFunc = $("#filtroFuncionario")?.value || "";
    const fProj = $("#filtroProjeto")?.value || "";
    const limite = parseInt($("#filtroLimite")?.value || DEFAULT_LIMIT, 10);

    let items = relatoriosState.fetched.slice();
    if (fFunc) items = items.filter(it => it.funcionario === fFunc);
    if (fProj) items = items.filter(it => it.projeto === fProj);

    items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    
    const view = items.slice(0, limite);
    relatoriosState.filtered = view;

    if ($("#kpiTotal")) $("#kpiTotal").textContent = view.length;
    renderLista(view);
  }

  async function carregarMeusRelatorios() {
    const db = getFirestore();
    const user = getPortalUser();
    if (!db || !user) return;

    if (!__USER_TIPO_READY__) await carregarUserTipo();
    setStatus("Carregando...", true);

    try {
      let query = db.collection(COLLECTION);
      if (__USER_TIPO__ !== "gestao") {
        query = query.where("createdByUid", "==", user.uid);
      }

      const snap = await query.orderBy("createdAt", "desc").limit(100).get();
      relatoriosState.fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      aplicarFiltrosELimite();
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus("Erro ao carregar.", false);
    }
  }

  // --------- Ações de Salvar e Boot ---------
  async function salvar(ev) {
    if (ev) ev.preventDefault();
    const db = getFirestore();
    const user = getPortalUser();
    if (!db || !user) return;

    const payload = {
      funcionario: $("#funcionario").value,
      projeto: $("#projeto").value,
      data: $("#data").value,
      atividade: $("#atividade").value,
      descricao: $("#descricao").value.trim(),
      observacao: $("#observacao").value.trim(),
      objetivoAlcancado: document.querySelector('input[name="objetivo"]:checked')?.value === "sim",
      updatedAt: serverTimestamp()
    };

    try {
      if (isEditing()) {
        await db.collection(COLLECTION).doc(__EDIT_ID__).update(payload);
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdByUid = user.uid;
        payload.createdByEmail = user.email || "";
        await db.collection(COLLECTION).add(payload);
      }
      limpar();
      setTab("meus");
      carregarMeusRelatorios();
    } catch (e) { setStatus("Erro ao salvar.", false); }
  }

  function limpar() {
    clearEditing();
    $("#descricao").value = "";
    $("#observacao").value = "";
    $all('input[name="objetivo"]').forEach(r => r.checked = false);
    $("#data").value = isoToday();
  }

  function bootComUsuario() {
    fillSelect($("#funcionario"), FUNCIONARIOS, "Selecione seu nome...");
    fillSelect($("#projeto"), PROJETOS, "Selecione o projeto...");
    fillSelect($("#atividade"), ATIVIDADES, "Selecione...");
    fillFilterSelect($("#filtroFuncionario"), FUNCIONARIOS, "Todos");
    fillFilterSelect($("#filtroProjeto"), PROJETOS, "Todos");

    $("#data").value = isoToday();

    // Eventos
    $all(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.tab;
        setTab(t);
        if (t === "meus") carregarMeusRelatorios();
      });
    });

    $("#formRelatorio")?.addEventListener("submit", salvar);
    $("#btnLimpar")?.addEventListener("click", limpar);
    
    // Delegação para editar/apagar
    $("#listaRelatorios")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button.ra-action");
      if (!btn) return;
      const id = btn.dataset.id;
      const it = relatoriosState.fetched.find(x => x.id === id);

      if (btn.classList.contains("ra-edit")) {
        setEditing(id, it.createdByUid);
        $("#funcionario").value = it.funcionario;
        $("#projeto").value = it.projeto;
        $("#data").value = it.data;
        $("#atividade").value = it.atividade;
        $("#descricao").value = it.descricao || "";
        $("#observacao").value = it.observacao || "";
        const rad = document.querySelector('input[name="objetivo"][value="' + (it.objetivoAlcancado ? 'sim' : 'nao') + '"]');
        if (rad) rad.checked = true;
        setTab("novo");
      } else if (btn.classList.contains("ra-del")) {
        if (confirm("Apagar?")) {
          await getFirestore().collection(COLLECTION).doc(id).delete();
          carregarMeusRelatorios();
        }
      }
    });

    setTab("novo");
  }

  ensureLoginOrRedirect();
})();
