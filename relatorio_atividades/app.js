/* =========================================================
   Relatório Diário de Atividades — Portal Relevo
   - Usa Firebase compat já inicializado pelo portal
   - Evita índice composto: consulta só por UID e ordena no cliente
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
     if (window.db) return window.db;                 // muitos módulos usam window.db
     if (window.firebase && window.firebase.firestore) return window.firebase.firestore();
     return null;
   }

  function getPortalUser() {
    const u = window.__RELEVO_USER__ || null;
    if (u && (u.uid || u.email)) return u;

    // fallback: compat auth
    try {
      const auth = window.__RELEVO_AUTH__ || (window.firebase && window.firebase.auth && window.firebase.auth());
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
          '<div style="font-weight:900;">Nenhum registro ainda.</div>' +
          '<div class="muted">Assim que você salvar, aparece aqui.</div>' +
        "</div>";
      return;
    }

    let html = "";
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const ok = !!it.objetivoAlcancado;
      const badgeClass = ok ? "badge ok" : "badge nok";
      const badgeTxt = ok ? "Objetivo: SIM" : "Objetivo: NÃO";

      const linha1 = escapeHtml(brDate(it.data)) + " • " + escapeHtml(it.projeto || "—");
      const linha2 = escapeHtml(it.atividade || "—");
      const desc = it.descricao ? '<div style="margin-top:8px; font-weight:700;">' + escapeHtml(it.descricao) + "</div>" : "";
      const obs = it.observacao ? '<div style="margin-top:6px;" class="muted">' + escapeHtml(it.observacao) + "</div>" : "";

      html +=
        '<div class="item">' +
          '<div class="row">' +
            '<div>' +
              '<div style="font-weight:900; color:#0b2e1b;">' + linha1 + "</div>" +
              '<div class="muted">' + linha2 + "</div>" +
            "</div>" +
            '<div class="' + badgeClass + '">' + badgeTxt + "</div>" +
          "</div>" +
          desc +
          obs +
        "</div>";
    }

    lista.innerHTML = html;
  }

  async function carregarMeusRelatorios() {
    const db = getFirestore();
    const user = getPortalUser();

    if (!db) { setStatus("Firestore não disponível no portal.", false); return; }

    // ✅ ALTERACAO: Não exigir usuário logado. Se não houver UID, não filtra.
    $("#kpiTotal").textContent = "…";
    $("#kpiOk").textContent = "…";

    try {
      let ref = db.collection(COLLECTION);

      // Se houver usuário logado, mantém o comportamento atual (somente "meus").
      if (user && user.uid) {
        ref = ref.where("createdByUid", "==", user.uid);
      }

      const snap = await ref.get();

      const items = snap.docs.map(function (d) {
        const data = d.data();
        data.id = d.id;
        return data;
      });

      // Ordena no cliente por createdAt desc (quando existir)
      items.sort(function (a, b) {
        const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });

      const total = items.length;
      let ok = 0;
      for (let i = 0; i < items.length; i++) if (items[i].objetivoAlcancado) ok++;
      const nok = total - ok;

      $("#kpiTotal").textContent = String(total);
      $("#kpiOk").textContent = String(ok) + " / " + String(nok);

      renderLista(items);

      // Pequeno aviso de UX: se não estiver logado, deixa claro que é lista geral (se houver dados).
      if (!user || !user.uid) {
        setStatus("Modo público: exibindo registros disponíveis.", true);
      }
    } catch (err) {
      console.error("❌ Erro ao carregar relatórios:", err);
      setStatus("Erro ao carregar relatórios. Veja o console.", false);
    }
  }

  // --------- Salvar ---------
  async function salvar(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();

    const db = getFirestore();
    const user = getPortalUser();

    if (!db) { setStatus("Firestore não disponível no portal.", false); return; }
    // ✅ ALTERACAO: Não exigir login para salvar.

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

      // ✅ ALTERACAO: Metadados opcionais (sem depender de login)
      createdByUid: (user && user.uid) ? user.uid : null,
      createdByEmail: (user && user.email) ? user.email : null
    };

    const btn = $("#btnSalvar");
    if (btn) btn.disabled = true;
    setStatus("Salvando...");

    try {
      await db.collection(COLLECTION).add(payload);
      setStatus("✅ Registro salvo com sucesso.");

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
    $("#descricao").value = "";
    $("#observacao").value = "";
    $all('input[name="objetivo"]').forEach(function (r) { r.checked = false; });
    setStatus("");
  }

  // --------- Boot ---------
  function init() {
    // Popula selects
    fillSelect($("#funcionario"), FUNCIONARIOS, "Selecione seu nome...");
    fillSelect($("#projeto"), PROJETOS, "Selecione o projeto...");
    fillSelect($("#atividade"), ATIVIDADES, "Selecione...");

    // Data default
    $("#data").value = isoToday();

    // Restore
    const savedFunc = localStorage.getItem("ra_funcionario");
    const savedProj = localStorage.getItem("ra_projeto");
    if (savedFunc && FUNCIONARIOS.indexOf(savedFunc) >= 0) $("#funcionario").value = savedFunc;
    if (savedProj && PROJETOS.indexOf(savedProj) >= 0) $("#projeto").value = savedProj;

    // User badge
    const badge = $("#userBadge");
    const u = getPortalUser();

    // ✅ ALTERACAO: não assustar usuário. Se não tiver login, mantém neutro.
    if (badge) badge.textContent = (u && (u.email || u.displayName)) ? (u.email || u.displayName) : "Acesso público";

    // Tabs
    $all(".tab-btn[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const tab = btn.getAttribute("data-tab");
        setTab(tab);
        if (tab === "meus") carregarMeusRelatorios();
      });
    });

    // Actions
    $("#formRelatorio").addEventListener("submit", salvar);
    $("#btnLimpar").addEventListener("click", limpar);
    $("#btnRecarregar").addEventListener("click", carregarMeusRelatorios);

    // PWA SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js")
        .then(function () { console.log("✅ SW registrado (Relatório Atividades)"); })
        .catch(function (e) { console.warn("⚠️ Falha ao registrar SW:", e); });
    }

    setTab("novo");
    setStatus("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
