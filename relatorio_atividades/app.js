/* =========================================================
   Relatório Diário de Atividades — Portal Relevo
   Versão Corrigida: Filtro de Usuário + Fallback
   ========================================================= */

(function () {
  "use strict";

  const FUNCIONARIOS = ["Samuel", "Tiago", "Gleysson", "Gerly", "Henever", "Roberto Aquino"];
  const PROJETOS = ["ADM Geral", "Grande Sertão 1", "BR-135/BA", "RIALMA"];
  const ATIVIDADES = ["deslocamento", "Campo diurno", "Campo noturno", "Escritório", "Folga", "Manutenção de equipamentos", "Treinamento", "Outro"];

  const COLLECTION = "relatorios_atividades";
  const relatoriosState = { fetched: [], filtered: [] };
  let __EDIT_ID__ = null;
  let __USER_TIPO__ = "colaborador"; 
  let __USER_TIPO_READY__ = false;

  // Helpers Básicos
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function setStatus(msg, ok) {
    const el = $("#statusMsg");
    if (el) { el.textContent = msg; el.style.color = ok === false ? "#8b1f1f" : "#0f4d2e"; }
  }
  function brDate(iso) { return iso ? iso.split('-').reverse().join('/') : "—"; }
  function escapeHtml(str) { return String(str || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m])); }

  // Firebase Access
  function getFirestore() { return window.__RELEVO_DB__ || window.db || (window.firebase && window.firebase.firestore()); }
  function getPortalUser() {
    const u = window.__RELEVO_USER__;
    if (u && u.uid) return u;
    const auth = window.firebase && window.firebase.auth && window.firebase.auth();
    const cu = auth && auth.currentUser;
    return cu ? { uid: cu.uid, email: cu.email } : null;
  }

  // Identifica se é Gestão ou Colaborador
  async function carregarUserTipo() {
    const db = getFirestore();
    const user = getPortalUser();
    if (!db || !user) { __USER_TIPO_READY__ = true; return "colaborador"; }
    try {
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        __USER_TIPO__ = (data.tipo || data.role || "colaborador").toLowerCase();
      }
    } catch (e) { console.error("Erro perfil:", e); }
    __USER_TIPO_READY__ = true;
    return __USER_TIPO__;
  }

  // Renderização da Lista
  function renderLista(items) {
    const lista = $("#listaRelatorios");
    if (!lista) return;
    if (!items.length) {
      lista.innerHTML = `<div class="item"><b>Nenhum relatório encontrado para o seu perfil.</b></div>`;
      return;
    }
    const user = getPortalUser();
    lista.innerHTML = items.map(it => {
      const canEdit = (__USER_TIPO__ === "gestao") || (it.createdByUid === user?.uid);
      return `
        <div class="item">
          <div class="row" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:900;">${escapeHtml(it.funcionario)} • ${escapeHtml(it.projeto)}</div>
              <div class="muted">${brDate(it.data)} • ${it.atividade}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <div class="badge ${it.objetivoAlcancado ? 'ok' : 'nok'}">${it.objetivoAlcancado ? 'SIM' : 'NÃO'}</div>
              ${canEdit ? `<button class="ra-action ra-edit" data-id="${it.id}">✏️</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // BUSCA DE DADOS (Aqui está a correção principal)
  async function carregarMeusRelatorios() {
    const db = getFirestore();
    const user = getPortalUser();
    if (!db || !user) return;

    if (!__USER_TIPO_READY__) await carregarUserTipo();
    setStatus("Buscando registros...", true);

    try {
      let query = db.collection(COLLECTION);
      let snap;

      if (__USER_TIPO__ === "gestao") {
        // Gestão vê tudo
        snap = await query.orderBy("createdAt", "desc").limit(100).get();
      } else {
        // Colaborador: Tentativa 1 (Com Filtro de Servidor - Exige Índice)
        try {
          snap = await query.where("createdByUid", "==", user.uid).orderBy("createdAt", "desc").limit(50).get();
        } catch (err) {
          console.warn("Falha no filtro de servidor (índice ausente?). Tentando filtro local...");
          // Fallback: Busca os últimos 100 e filtra no navegador para não travar o usuário
          snap = await query.orderBy("createdAt", "desc").limit(100).get();
        }
      }

      let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Se não for gestão, garantir que ele só veja o dele (dupla checagem local)
      if (__USER_TIPO__ !== "gestao") {
        items = items.filter(it => it.createdByUid === user.uid);
      }

      relatoriosState.fetched = items;
      renderLista(items);
      setStatus(__USER_TIPO__ === "gestao" ? "Modo Gestão: Vendo tudo" : "Vendo seus relatórios", true);

    } catch (e) {
      console.error(e);
      setStatus("Erro de conexão com o banco.", false);
    }
  }

  // Salvar e Editar (Reutilizando a lógica anterior)
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
      descricao: ($("#descricao")?.value || "").trim(),
      observacao: ($("#observacao")?.value || "").trim(),
      objetivoAlcancado: document.querySelector('input[name="objetivo"]:checked')?.value === "sim",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdByUid: __EDIT_ID__ ? undefined : user.uid // Não sobrescreve o dono na edição
    };

    try {
      if (__EDIT_ID__) {
        await db.collection(COLLECTION).doc(__EDIT_ID__).update(payload);
      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection(COLLECTION).add(payload);
      }
      location.reload(); // Recarrega para limpar estado
    } catch (e) { setStatus("Erro ao salvar.", false); }
  }

  function boot() {
    // Popula Selects
    const f = (id, vals) => { 
        const el = $(id); 
        if(el) vals.forEach(v => { const o = document.createElement("option"); o.value=v; o.textContent=v; el.appendChild(o); });
    };
    f("#funcionario", FUNCIONARIOS);
    f("#projeto", PROJETOS);
    f("#atividade", ATIVIDADES);

    $("#formRelatorio")?.addEventListener("submit", salvar);
    $all(".tab-btn").forEach(b => b.addEventListener("click", () => {
        const t = b.dataset.tab;
        $all(".tab-panel").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== t));
        if (t === "meus") carregarMeusRelatorios();
    }));
  }

  // Auth Guard
  const auth = window.firebase && window.firebase.auth && window.firebase.auth();
  auth?.onAuthStateChanged(u => { if (u) boot(); else window.location.href = "/index.html"; });

})();
