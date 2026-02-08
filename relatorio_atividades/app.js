(function () {
  "use strict";

  // 1. CONFIGURAÇÕES E LISTAS
  const FUNCIONARIOS = ["Samuel", "Tiago", "Gleysson", "Gerly", "Henever", "Roberto Aquino"];
  const PROJETOS = ["ADM Geral", "Grande Sertão 1", "BR-135/BA", "RIALMA"];
  const ATIVIDADES = ["deslocamento", "Campo diurno", "Campo noturno", "Escritório", "Folga", "Manutenção de equipamentos", "Treinamento", "Outro"];
  const COLLECTION = "relatorios_atividades";

  const relatoriosState = { fetched: [], filtered: [] };
  let __EDIT_ID__ = null;
  let __USER_TIPO__ = "colaborador"; 
  let __USER_TIPO_READY__ = false;

  // 2. HELPERS DE DOM E UTILITÁRIOS
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
  
  function setStatus(msg, ok) {
    const el = $("#statusMsg");
    if (el) { 
      el.textContent = msg; 
      el.style.color = ok === false ? "#8b1f1f" : "#00D166"; 
    }
  }

  function brDate(iso) { return iso ? iso.split('-').reverse().join('/') : "—"; }
  function isoToday() { return new Date().toISOString().split('T')[0]; }
  
  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  // 3. FIREBASE & AUTH
  const getFirestore = () => window.__RELEVO_DB__ || window.db || (window.firebase && window.firebase.firestore());
  
  function getPortalUser() {
    const u = window.__RELEVO_USER__;
    if (u && u.uid) return u;
    const auth = window.firebase && window.firebase.auth && window.firebase.auth();
    return auth && auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : null;
  }

  async function carregarUserTipo() {
    const db = getFirestore();
    const user = getPortalUser();
    if (!db || !user) { __USER_TIPO_READY__ = true; return; }
    try {
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        __USER_TIPO__ = (data.tipo || data.role || data.perfil || "colaborador").toLowerCase();
      }
    } catch (e) { console.error("Erro ao carregar perfil:", e); }
    __USER_TIPO_READY__ = true;
  }

  // 4. RENDERIZAÇÃO E FILTROS
  function renderLista(items) {
    const lista = $("#listaRelatorios");
    if (!lista) return;
    if (!items.length) {
      lista.innerHTML = `<div class="item"><b>Nenhum registro encontrado.</b></div>`;
      return;
    }

    const user = getPortalUser();
    lista.innerHTML = items.map(it => {
      const ok = !!it.objetivoAlcancado;
      const canEdit = (__USER_TIPO__ === "gestao") || (it.createdByUid === user?.uid);
      
      return `
        <div class="item">
          <div class="row" style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:900; color:#3B4D3C;">${escapeHtml(it.funcionario)} • ${escapeHtml(it.projeto)}</div>
              <div class="muted" style="font-size:0.85rem;">${brDate(it.data)} • ${escapeHtml(it.atividade)}</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <div class="badge ${ok ? 'ok' : 'nok'}">${ok ? 'OBJETIVO ATINGIDO' : 'NÃO ATINGIDO'}</div>
              ${canEdit ? `
                <div style="display:flex; gap:4px;">
                  <button class="ra-action ra-edit" data-id="${it.id}" title="Editar">✏️</button>
                  <button class="ra-action ra-del" data-id="${it.id}" title="Apagar" style="color:#8b1f1f;">🗑️</button>
                </div>
              ` : ''}
            </div>
          </div>
          ${it.descricao ? `<div style="margin-top:8px; font-weight:600;">${escapeHtml(it.descricao)}</div>` : ""}
          ${it.observacao ? `<div style="margin-top:4px; font-size:0.85rem;" class="muted">obs: ${escapeHtml(it.observacao)}</div>` : ""}
        </div>
      `;
    }).join('');
  }

  async function carregarMeusRelatorios() {
    const db = getFirestore();
    const user = getPortalUser();
    if (!db || !user) return;

    if (!__USER_TIPO_READY__) await carregarUserTipo();
    setStatus("Atualizando lista...", true);

    try {
      let query = db.collection(COLLECTION);
      let snap;

      // Lógica de busca com Fallback para evitar erros de índice
      try {
        if (__USER_TIPO__ === "gestao") {
          snap = await query.orderBy("createdAt", "desc").limit(100).get();
        } else {
          snap = await query.where("createdByUid", "==", user.uid).orderBy("createdAt", "desc").limit(100).get();
        }
      } catch (err) {
        console.warn("Filtro de servidor falhou, buscando sem ordem (fallback local)...");
        snap = (__USER_TIPO__ === "gestao") 
          ? await query.limit(100).get() 
          : await query.where("createdByUid", "==", user.uid).limit(100).get();
      }

      let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Ordenação manual caso o Firebase falhe na ordem
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      relatoriosState.fetched = items;
      renderLista(items);
      setStatus(__USER_TIPO__ === "gestao" ? "Painel Gestão: Vendo todos" : "Seus relatórios recentes", true);
    } catch (e) {
      console.error(e);
      setStatus("Erro ao carregar dados.", false);
    }
  }

  // 5. SALVAR / EDITAR / LIMPAR
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
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const btn = $("#btnSalvar");
    if(btn) btn.disabled = true;

    try {
      if (__EDIT_ID__) {
        await db.collection(COLLECTION).doc(__EDIT_ID__).update(payload);
        setStatus("✅ Atualizado com sucesso!", true);
      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        payload.createdByUid = user.uid;
        payload.createdByEmail = user.email;
        await db.collection(COLLECTION).add(payload);
        setStatus("✅ Salvo com sucesso!", true);
      }
      limpar();
      setTab("meus");
      carregarMeusRelatorios();
    } catch (e) {
      console.error(e);
      setStatus("Erro ao salvar.", false);
    } finally {
      if(btn) btn.disabled = false;
    }
  }

  function limpar() {
    __EDIT_ID__ = null;
    $("#btnSalvar").textContent = "Salvar";
    $("#descricao").value = "";
    $("#observacao").value = "";
    $all('input[name="objetivo"]').forEach(r => r.checked = false);
    $("#data").value = isoToday();
    setStatus("", true);
  }

  function setTab(name) {
    $all(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    $all(".tab-panel").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== name));
  }

  // 6. BOOT E EVENTOS
  function boot() {
    const populate = (id, list) => {
      const el = $(id);
      if (!el) return;
      el.innerHTML = `<option value="" disabled selected>Selecione...</option>`;
      list.forEach(v => el.innerHTML += `<option value="${v}">${v}</option>`);
    };

    populate("#funcionario", FUNCIONARIOS);
    populate("#projeto", PROJETOS);
    populate("#atividade", ATIVIDADES);
    $("#data").value = isoToday();

    // Eventos de clique na lista (Edição e Deleção)
    $("#listaRelatorios")?.addEventListener("click", async (e) => {
      const btn = e.target.closest(".ra-action");
      if (!btn) return;
      const id = btn.dataset.id;
      const it = relatoriosState.fetched.find(x => x.id === id);

      if (btn.classList.contains("ra-edit")) {
        __EDIT_ID__ = id;
        $("#funcionario").value = it.funcionario;
        $("#projeto").value = it.projeto;
        $("#data").value = it.data;
        $("#atividade").value = it.atividade;
        $("#descricao").value = it.descricao || "";
        $("#observacao").value = it.observacao || "";
        const rad = document.querySelector(`input[name="objetivo"][value="${it.objetivoAlcancado ? 'sim' : 'nao'}"]`);
        if (rad) rad.checked = true;
        
        $("#btnSalvar").textContent = "Atualizar";
        setTab("novo");
        window.scrollTo(0,0);
      } else if (btn.classList.contains("ra-del")) {
        if (confirm("Deseja realmente excluir este relatório?")) {
          await getFirestore().collection(COLLECTION).doc(id).delete();
          carregarMeusRelatorios();
        }
      }
    });

    $all(".tab-btn").forEach(b => b.addEventListener("click", () => {
      setTab(b.dataset.tab);
      if (b.dataset.tab === "meus") carregarMeusRelatorios();
    }));

    $("#formRelatorio")?.addEventListener("submit", salvar);
    $("#btnLimpar")?.addEventListener("click", limpar);
    
    // PWA Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(e => console.warn("SW erro:", e));
    }
  }

  // 7. INICIALIZAÇÃO COM AUTH GUARD
  const init = () => {
    const auth = window.firebase && window.firebase.auth && window.firebase.auth();
    auth?.onAuthStateChanged(u => {
      if (u) { boot(); } 
      else { window.location.href = "/index.html"; }
    });
  };

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
