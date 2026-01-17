/* global firebase */

// ============================================================
// RELATÓRIO DIÁRIO DE ATIVIDADES — Portal Relevo (Firebase compat)
// Salva no Firestore do portal: coleção "relatorios_atividades"
// ============================================================

(() => {
  const COLECAO = 'relatorios_atividades';

  const CONFIG = {
    projetos: ['ADM Geral', 'BR-135/BA', 'EOL Ibitiara/Assurua', 'LT Rialma', 'Grande Sertão 1'],
    funcionarios: ['Gleisson', 'Sandro', 'Emílio', 'Yuri', 'João', 'Danilo', 'Roberto Aquino', 'Daniel', 'Tiago', 'Samuel Neto', 'Roberto Inácio', 'Samuel Almeida', 'Gerly', 'Henever'],
    atividades: [
      'Deslocamento',
      'Campo diurno',
      'Campo noturno',
      'Escritório',
      'Folga',
      'Manutenção de equipamentos',
      'Treinamento',
      'Outro (descrever nas observações)'
    ]
  };

  // ---- DOM
  const el = (id) => document.getElementById(id);

  const tabNovo = el('tabNovo');
  const tabMeus = el('tabMeus');
  const secNovo = el('secNovo');
  const secMeus = el('secMeus');

  const form = el('formRelatorio');
  const funcionarioSel = el('funcionario');
  const projetoSel = el('projeto');
  const dataInp = el('data');
  const atividadeSel = el('atividade');
  const descricaoInp = el('descricao');
  const observacaoInp = el('observacao');
  const objetivoSim = el('objetivoSim');
  const objetivoNao = el('objetivoNao');

  const btnSalvar = el('btnSalvar');

  const meusInicio = el('meusInicio');
  const meusFim = el('meusFim');
  const btnMeusLimpar = el('btnMeusLimpar');
  const btnMeusAtualizar = el('btnMeusAtualizar');
  const meusLista = el('meusLista');
  const meusVazio = el('meusVazio');
  const meusQtd = el('meusQtd');
  const meusOk = el('meusOk');
  const meusNok = el('meusNok');

  const toast = el('toast');

  // ---- Firebase
  const db = window.__RELEVO_DB__ || (window.firebase && firebase.firestore && firebase.firestore());
  const auth = window.__RELEVO_AUTH__ || (window.firebase && firebase.auth && firebase.auth());

  if (!db || !auth) {
    console.error('❌ Relatório Atividades: Firebase do portal não está disponível.');
    alert('Firebase do portal não está disponível. Recarregue a página pelo Portal.');
    return;
  }

  // Persistência offline (best effort)
  try {
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (_) {}

  // ---- Helpers
  function hojeISO() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  }

  function toastMsg(msg, type = 'info') {
    toast.textContent = msg;
    toast.classList.remove('show', 'ok', 'error');
    if (type === 'ok') toast.classList.add('ok');
    if (type === 'error') toast.classList.add('error');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function setTab(which) {
    const isNovo = which === 'novo';
    tabNovo.classList.toggle('active', isNovo);
    tabMeus.classList.toggle('active', !isNovo);
    secNovo.classList.toggle('hidden', !isNovo);
    secMeus.classList.toggle('hidden', isNovo);
  }

  function fillSelect(select, values, placeholder) {
    select.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder;
    opt0.disabled = true;
    opt0.selected = true;
    select.appendChild(opt0);

    values.forEach((v) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      select.appendChild(o);
    });
  }

  function sanitizeText(s) {
    return (s || '').toString().trim();
  }

  function getCurrentUser() {
    const u = window.__RELEVO_USER__ || auth.currentUser;
    if (!u) return null;
    if (u.uid) return { uid: u.uid, email: u.email || null };
    return { uid: u.raw?.uid || null, email: u.raw?.email || null };
  }

  function enableForm(enabled) {
    [funcionarioSel, projetoSel, dataInp, atividadeSel, descricaoInp, observacaoInp, objetivoSim, objetivoNao, btnSalvar]
      .forEach((n) => { if (n) n.disabled = !enabled; });
  }

  // ---- Init UI
  function init() {
    // selects
    fillSelect(funcionarioSel, CONFIG.funcionarios, 'Selecione seu nome');
    fillSelect(projetoSel, CONFIG.projetos, 'Selecione o projeto');
    fillSelect(atividadeSel, CONFIG.atividades, 'Selecione a atividade');

    // data
    dataInp.value = hojeISO();

    // lembrar ultimo nome/projeto
    try {
      const lastNome = localStorage.getItem('relatorio_funcionario') || '';
      const lastProjeto = localStorage.getItem('relatorio_projeto') || '';
      if (lastNome && CONFIG.funcionarios.includes(lastNome)) funcionarioSel.value = lastNome;
      if (lastProjeto && CONFIG.projetos.includes(lastProjeto)) projetoSel.value = lastProjeto;
    } catch (_) {}

    // tabs
    tabNovo.addEventListener('click', () => setTab('novo'));
    tabMeus.addEventListener('click', () => {
      setTab('meus');
      carregarMeus();
    });

    // form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      salvar();
    });

    // meus filtros
    btnMeusLimpar.addEventListener('click', () => {
      meusInicio.value = '';
      meusFim.value = '';
      carregarMeus();
    });

    btnMeusAtualizar.addEventListener('click', () => carregarMeus());

    // observar auth
    auth.onAuthStateChanged((user) => {
      if (!user) {
        enableForm(false);
        toastMsg('Faça login no Portal para lançar seu relatório.', 'error');
        return;
      }
      enableForm(true);
    });

    // PWA SW
    registrarServiceWorker();

    // deep link
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'meus') {
      setTab('meus');
      carregarMeus();
    }
  }

  async function salvar() {
    const funcionario = funcionarioSel.value;
    const projeto = projetoSel.value;
    const data = dataInp.value || hojeISO();
    const atividade = atividadeSel.value;
    const descricao = sanitizeText(descricaoInp.value);
    const observacao = sanitizeText(observacaoInp.value);
    const objetivoAlcancado = objetivoSim.checked ? true : (objetivoNao.checked ? false : null);

    const obrigatorios = [
      [funcionario, 'Nome'],
      [projeto, 'Projeto'],
      [data, 'Data'],
      [atividade, 'Atividade realizada'],
      [objetivoAlcancado !== null, 'Objetivo alcançado']
    ];

    const faltando = obrigatorios.find(([ok]) => !ok);
    if (faltando) {
      toastMsg(`Preencha: ${faltando[1]}.`, 'error');
      return;
    }

    const user = getCurrentUser();

    const payload = {
      funcionario,
      projeto,
      data, // yyyy-mm-dd
      atividade,
      descricao,
      observacao,
      objetivoAlcancado,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdByUid: user?.uid || null,
      createdByEmail: user?.email || null,
      origem: 'portal-relevo/relatorio_atividades'
    };

    try {
      btnSalvar.disabled = true;
      btnSalvar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...';

      await db.collection(COLECAO).add(payload);

      try {
        localStorage.setItem('relatorio_funcionario', funcionario);
        localStorage.setItem('relatorio_projeto', projeto);
      } catch (_) {}

      // reset (mantendo nome/projeto)
      atividadeSel.selectedIndex = 0;
      descricaoInp.value = '';
      observacaoInp.value = '';
      objetivoSim.checked = false;
      objetivoNao.checked = false;
      dataInp.value = hojeISO();

      toastMsg('Relatório salvo. Missão cumprida ✅', 'ok');
    } catch (err) {
      console.error('❌ Erro ao salvar relatório:', err);
      toastMsg('Erro ao salvar. Verifique sua conexão e tente novamente.', 'error');
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Relatório';
    }
  }

  async function carregarMeus() {
    meusLista.innerHTML = '';
    meusVazio.style.display = 'none';
    meusQtd.textContent = 'Itens: 0';
    meusOk.textContent = 'OK: 0';
    meusNok.textContent = 'NOK: 0';

    const user = getCurrentUser();
    const funcionario = funcionarioSel.value || (tryGetLocal('relatorio_funcionario') || '');

    if (!user?.uid && !funcionario) {
      meusVazio.style.display = '';
      return;
    }

    let q = db.collection(COLECAO);

    // Evitar índice composto: query simples (sem orderBy), e ordena no client.
    if (user?.uid) {
      q = q.where('createdByUid', '==', user.uid);
    } else {
      q = q.where('funcionario', '==', funcionario);
    }

    // Limite para não explodir o mobile.
    q = q.limit(100);

    try {
      const snap = await q.get();
      let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const di = meusInicio.value || '';
      const df = meusFim.value || '';
      if (di) items = items.filter((it) => (it.data || '') >= di);
      if (df) items = items.filter((it) => (it.data || '') <= df);

      items.sort((a, b) => {
        const da = a.data || '';
        const dbb = b.data || '';
        if (da === dbb) return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
        return dbb.localeCompare(da);
      });

      if (!items.length) {
        meusVazio.style.display = '';
        return;
      }

      let ok = 0;
      let nok = 0;

      items.forEach((it) => {
        if (it.objetivoAlcancado) ok += 1; else nok += 1;
        meusLista.appendChild(renderCard(it));
      });

      meusQtd.textContent = `Itens: ${items.length}`;
      meusOk.textContent = `OK: ${ok}`;
      meusNok.textContent = `NOK: ${nok}`;

    } catch (err) {
      console.error('❌ Erro ao carregar meus relatórios:', err);
      toastMsg('Não consegui carregar seus relatórios agora. Tente de novo.', 'error');
      meusVazio.style.display = '';
    }
  }

  function renderCard(it) {
    const wrap = document.createElement('div');
    wrap.className = 'card';

    const top = document.createElement('div');
    top.className = 'card-top';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = it.projeto || '—';

    const badge = document.createElement('span');
    badge.className = 'badge ' + (it.objetivoAlcancado ? 'ok' : 'nok');
    badge.textContent = it.objetivoAlcancado ? 'Objetivo: SIM' : 'Objetivo: NÃO';

    top.appendChild(title);
    top.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <span><i class="fa-regular fa-calendar"></i> ${it.data || '—'}</span>
      <span><i class="fa-solid fa-person-walking"></i> ${it.funcionario || '—'}</span>
    `;

    const activity = document.createElement('div');
    activity.className = 'activity';
    activity.innerHTML = `<i class="fa-solid fa-clipboard-check"></i> ${escapeHtml(it.atividade || '—')}`;

    const desc = document.createElement('div');
    desc.className = 'text';
    const d = sanitizeText(it.descricao);
    desc.innerHTML = d ? `<b>Descrição:</b> ${escapeHtml(d)}` : '<span class="muted">Sem descrição.</span>';

    const obs = document.createElement('div');
    obs.className = 'text';
    const o = sanitizeText(it.observacao);
    obs.innerHTML = o ? `<b>Obs.:</b> ${escapeHtml(o)}` : '<span class="muted">Sem observações.</span>';

    wrap.appendChild(top);
    wrap.appendChild(meta);
    wrap.appendChild(activity);
    wrap.appendChild(desc);
    wrap.appendChild(obs);

    return wrap;
  }

  function escapeHtml(str) {
    return (str || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function tryGetLocal(key) {
    try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }

  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('✅ SW registrado (Relatório Atividades)'))
        .catch((e) => console.warn('⚠️ Falha ao registrar SW:', e));
    });
  }

  init();
})();
