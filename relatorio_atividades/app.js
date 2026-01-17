/* =========================================================
   Relatório Diário de Atividades — Portal Relevo
   - Usa Firebase compat já inicializado pelo portal
   - Evita índices compostos: consulta só por UID e ordena no cliente
   ========================================================= */

(function () {
  // --------- Config: listas (cole aqui as mesmas do app.jsx de despesas) ---------
  // Dica: mantenha esses arrays como “fonte única” também neste módulo.
  const FUNCIONARIOS = [
    // Substitua pelos nomes existentes no app.jsx de despesas:
    "Samuel",
    "Tiago",
    "Gleysson",
    "Gerly",
    "Henever",
    "Roberto Aquino"
  ];

  const PROJETOS = [
    // Substitua pelos projetos existentes no app.jsx de despesas:
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

  // --------- Helpers ---------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function brDate(isoDate) {
    if (!isoDate) return "";
    // isoDate: yyyy-mm-dd
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function setStatus(msg, ok = true) {
    const el = $("#statusMsg");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = ok ? "#0f4d2e" : "#8b1f1f";
  }

  function fillSelect(selectEl, values, placeholder = "Selecione…") {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    opt0.disabled = true;
    opt0.selected = true;
    selectEl.appendChild(opt0);

    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }

  function getPortalUser() {
    // O portal costuma expor usuário globalmente (ex.: expose-session.js)
    const u = window.__RELEVO_USER__ || null;
    if (u && (u.uid || u.email)) return u;

    const auth = window.__RELEVO_AUTH__ || window.firebase?.auth?.();
    const cu = auth?.currentUser || null;
    if (cu) return { uid: cu.uid, email: cu.email, displayName: cu.displayName };

    return null;
  }

  function getFirestore() {
    // Preferência total ao objeto já exposto pelo portal (compat)
    if (window.__RELEVO_DB__) return window.__RELEVO_DB__;

    // Fallback: se o portal carregou firebase global e inicializou
    if (window.firebase?.firestore) return window.firebase.firestore();

    return null;
  }

  function serverTimestamp() {
    // compat FieldValue
    return window.firebase?.firestore?.FieldValue?.serverTimestamp
      ? window.firebase.firestore.FieldValue.serverTimestamp()
      : new Date();
  }

  // --------- Tabs (blindado) ---------
  function setTab(tab) {
    const btns = $$(".tab-btn[data-tab]");
    const panels = $$(".tab-panel[data-panel]");

    if (!btns.length || !panels.length) {
      console.warn("[Relatorio] Tabs/painéis não encontrados. Verifique index.html.");
      return;
    }

    btns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    panels.forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== tab));
  }

  // --------- Render list ---------
  function renderLista(items) {
    const lista = $("#listaRelatorios");
    if (!lista) return;

    if (!items.length) {
      lista.innerHTML = `<div class="item"><div style="font-weight:900;">Nenhum registro ainda.</div><div class="muted">Assim que você salvar, aparece aqui.</div></div>`;
      return;
    }

    lista.innerHTML = items
      .map((it) => {
        const ok = !!it.objetivoAlcancado;
        const badgeClass = ok ? "badge ok" : "badge nok";
        const badgeTxt = ok ? "Objetivo: SIM" : "Objetivo: NÃO";
        const dataTxt = it.data ? brDate(it.data) : "—";
        const projeto = safeText(it.projeto) || "—";
        const atividade = safeText(it.atividade) || "—";
        const desc = safeText(it.descricao);
        const obs = safeText(it.observacao);

        return `
          <div class="item">
            <div class="row">
              <div>
                <div style="font-weight:900; color:#0b2e1b;">${dataTxt} • ${projeto}</div>
                <div class="muted">${atividade}</div>
              </div>
              <div class="${badgeClass}">${badgeTxt}</div>
            </div>
            ${desc ? `<div style="margin-top:8px; font-weight:700;">${escapeHtml(desc)}</div>` : ""}
            ${obs ? `<div style="margin-top:6px;" class="muted">${escapeHtml(obs)}</div>` : ""}
          </div>
        `;
      })
      .join("");
  }

  function escapeHtml(str) {
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --------- Load my reports (no composite index) ---------
  async function carregarMeusRelatorios() {
    const db = getFirestore();
    const user = getPortalUser();

    if (!db) {
      setStatus("Firebase/Firestore não disponível no portal.", false);
      return;
    }
    if (!user?.uid) {
      setStatus("Usuário não identificado. Faça login no portal.", false);
      return;
    }

    $("#kpiTotal").textContent = "…";
    $("#kpiOk").textContent = "…";

    try {
      // Sem orderBy para evitar índice composto; ordenamos no cliente.
      const snap = await db
        .collection(COLLECTION)
        .where("createdByUid", "==", user.uid)
        .get();

      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Ordenação cliente: createdAt desc quando existir
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return tb - ta;
      });

      const total = items.length;
      const ok = items.filter((x) => !!x.objetivoAlcancado).length;
      const nok = total - ok;

      $("#kpiTotal").textContent = String(total);
      $("#kpiOk").textContent = `${ok} / ${nok}`;

      renderLista(items);
    } catch (err) {
      console.error("❌ Erro ao carregar relatórios:", err);
      setStatus("Erro ao carregar seus relatórios. Veja o console.", false);
    }
  }

  // --------- Save ---------
  async function salvar(e) {
    e?.preventDefault?.();

    const db = getFirestore();
    const user = getPortalUser();

    if (!db) {
      setStatus("Firebase/Firestore não disponível no portal.", false);
      return;
    }
    if (!user?.uid) {
      setStatus("Usuário não identificado. Faça login no portal.", false);
      return;
    }

    const funcionario = $("#funcionario")?.value || "";
    const projeto = $("#projeto")?.value || "";
    const data = $("#data")?.value || "";
    const atividade = $("#atividade")?.value || "";
    const descricao = safeText($("#descricao")?.value || "");
    const observacao = safeText($("#observacao")?.value || "");

    const objetivoVal = document.querySelector('input[name="objetivo"]:checked')?.value;
    if (!objetivoVal) {
      alert("Selecione se o objetivo foi alcançado (Sim ou Não).");
      return;
    }
    const objetivoAlcancado = (objetivoVal === "sim");

    if (!funcionario || !projeto || !data || !atividade) {
      alert("Preencha Nome, Projeto, Data e Atividade.");
      return;
    }

    // Persistir seleções para facilitar preenchimento no mobile
    localStorage.setItem("ra_funcionario", funcionario);
    localStorage.setItem("ra_projeto", projeto);

    const payload = {
      funcionario,
      projeto,
      data,
      atividade,
      descricao,
      observacao,
      objetivoAlcancado,

      createdAt: serverTimestamp(),
      createdByUid: user.uid,
      createdByEmail: user.email || "",
    };

    const btn = $("#btnSalvar");
    if (btn) btn.disabled = true;
    setStatus("Salvando…");

    try {
      await db.collection(COLLECTION).add(payload);
      setStatus("✅ Registro salvo com sucesso.");

      // Limpar campos de texto (mantém dropdowns e data)
      $("#descricao").value = "";
      $("#observacao").value = "";
      // reseta objetivo
      $$('input[name="objetivo"]').forEach((r) => (r.checked = false));

      // Vai pra aba “Meus” e recarrega
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
    $$('input[name="objetivo"]').forEach((r) => (r.checked = false));
    setStatus("");
  }

  // --------- Init ---------
  function initUI() {
    // selects
    fillSelect($("#funcionario"), FUNCIONARIOS, "Selecione seu nome…");
    fillSelect($("#projeto"), PROJETOS, "Selecione o projeto…");
    fillSelect($("#atividade"), ATIVIDADES, "Selecione…");

    // data hoje
    const today = new Date();
    const yyyy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    $("#data").value = iso;

    // restore selections
    const savedFunc = localStorage.getItem("ra_funcionario");
    const savedProj = localStorage.getItem("ra_projeto");
    if (savedFunc && FUNCIONARIOS.includes(savedFunc)) $("#funcionario").value = savedFunc;
    if (savedProj && PROJETOS.includes(savedProj)) $("#projeto").value = savedProj;

    // tabs handlers
    $$(".tab-btn[data-tab]").forEach((btn) => {
      btn.addEventListener("click"
