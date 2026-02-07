// ✅ Limite padrão de exibição na aba "Meus lançamentos" (mais recentes)
const LIMITE_PADRAO_MEUS = 10;
// (fallback) se algum bundling/escopo esconder a constante, garante valor
// eslint-disable-next-line no-unused-vars
const __LIMITE_PADRAO_MEUS__ = LIMITE_PADRAO_MEUS;

// ============================================
// APP DE DESPESAS - VERSÃO CORRIGIDA E INTEGRADA
// Relevo Consultoria Ambiental - 2025
// ============================================
// Agora utiliza a instância isolada do Firebase (despesasApp)
// via window.db e window.storage configuradas no firebase-config.js
// ============================================

class DespesasApp {
  constructor() {
    this.CONFIG = {
      projetos: ['ADM Geral', 'BR-135/BA', 'EOL Ibitiara/Assurua', 'LT Rialma', 'Grande Sertão 1'],
      funcionarios: ['Gleisson', 'Sandro', 'Emílio', 'Yuri', 'João', 'Danilo', 'Roberto Aquino', 'Daniel', 'Tiago', 'Samuel Neto', 'Roberto Inácio', 'Samuel Almeida', 'Gerly', 'Henever'],
      tiposDespesa: [
        'Água', 'Almoço / Jantar', 'Aluguel de Carro', 'Café da Manhã',
        'Combustível', 'Correios', 'EPI', 'Ferramentas', 'Hospedagem / Hotel',
        'Lanche / Refeição Leve', 'Lavagem do Veículo', 'Manutenção de Equipamento',
        'Material de Escritório', 'Passagens', 'Pedágio', 'Táxi / Uber / Aplicativos', 'Exames', 'Outros'
      ],
      maxFileSize: 10 * 1024 * 1024,
      acceptedFileTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    };

    this.init();
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  init() {
    console.log('🚀 Inicializando App de Despesas...');
    if (!window.db || !window.storage) {
      console.error('❌ Firebase (App de Despesas) não inicializado corretamente!');
      alert('Erro de conexão com o servidor. Recarregue a página.');
      return;
    }

    this.carregarSelects();
    this.setDataAtual();
    this.setupEventListeners();
    this.setupTabs();
    this.setupMeusLancamentos();
    console.log('✅ App de Despesas pronto - Upload HABILITADO');
  }

  // ============================================
  // EVENTOS
  // ============================================
  setupEventListeners() {
    const form = document.getElementById('formDespesa');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.salvarDespesa();
    });

    const comprovante = document.getElementById('comprovante');
    comprovante.addEventListener('change', (e) => this.previewComprovante(e.target.files[0]));

    const valorInput = document.getElementById('valor');
    valorInput.addEventListener('input', (e) => this.aplicarMascaraMonetaria(e.target));
    valorInput.addEventListener('blur', (e) => this.formatarValor(e.target));
  }

  // ============================================
  // CARREGAMENTO DE SELECTS
  // ============================================
  carregarSelects() {
    this.carregarOptions('projeto', this.CONFIG.projetos);
    this.carregarOptions('funcionario', this.CONFIG.funcionarios);
    this.carregarOptions('tipo', this.CONFIG.tiposDespesa);
    console.log('✅ Selects carregados');
  }

  carregarOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return console.warn(`⚠️ Select ${selectId} não encontrado`);
    select.innerHTML = '<option value="">Selecione...</option>';
    options.forEach(opt => select.innerHTML += `<option value="${opt}">${opt}</option>`);
  }



  // ============================================
  // ABAS (Registro / Meus lançamentos)
  // ============================================
  setupTabs() {
    const btnRegistro = document.getElementById('tabBtnRegistro');
    const btnMeus = document.getElementById('tabBtnMeus');
    const tabRegistro = document.getElementById('tabRegistro');
    const tabMeus = document.getElementById('tabMeus');

    // Se a página estiver sendo usada em outra versão sem abas, não quebra.
    if (!btnRegistro || !btnMeus || !tabRegistro || !tabMeus) return;

    const ativar = (qual) => {
      const isRegistro = qual === 'registro';

      btnRegistro.classList.toggle('active', isRegistro);
      btnMeus.classList.toggle('active', !isRegistro);

      btnRegistro.setAttribute('aria-selected', String(isRegistro));
      btnMeus.setAttribute('aria-selected', String(!isRegistro));

      tabRegistro.classList.toggle('active', isRegistro);
      tabMeus.classList.toggle('active', !isRegistro);

      // Persistência simples: lembra última aba (bom pra quem só quer conferir a lista)
      try { localStorage.setItem('despesas_ultima_aba', isRegistro ? 'registro' : 'meus'); } catch (_) {}

      if (!isRegistro) {
        // Ao abrir a aba "Meus lançamentos", puxa a lista automaticamente.
        this.carregarMeusLancamentos();
      }
    };

    btnRegistro.addEventListener('click', () => ativar('registro'));
    btnMeus.addEventListener('click', () => ativar('meus'));

    // Restaura última aba
    try {
      const ultima = localStorage.getItem('despesas_ultima_aba');
      if (ultima === 'meus') ativar('meus');
    } catch (_) {
      // nada
    }
  }

  // ============================================
  // MEUS LANÇAMENTOS (filtro por funcionário + período)
  // ============================================
  setupMeusLancamentos() {
    const meusFuncionario = document.getElementById('meusFuncionario');
    const btnAtualizar = document.getElementById('btnMeusAtualizar');
    const btnLimpar = document.getElementById('btnMeusLimpar');

    if (!meusFuncionario || !btnAtualizar || !btnLimpar) return;

    // Preenche lista de funcionários na aba
    meusFuncionario.innerHTML = '<option value="">Selecione...</option>';
    this.CONFIG.funcionarios.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      meusFuncionario.appendChild(opt);
    });

    // Lembrar funcionário (pra quem lança no mesmo nome sempre)
    const formFuncionario = document.getElementById('funcionario');
    const restaurarFuncionario = () => {
      try {
        const salvo = localStorage.getItem('despesas_funcionario');
        if (salvo) {
          if (formFuncionario) formFuncionario.value = salvo;
          meusFuncionario.value = salvo;
        }
      } catch (_) {}
    };

    restaurarFuncionario();

    // Sempre que mudar no formulário, espelha na aba "Meus" + salva
    if (formFuncionario) {
      formFuncionario.addEventListener('change', () => {
        try { localStorage.setItem('despesas_funcionario', formFuncionario.value || ''); } catch (_) {}
        if (formFuncionario.value) meusFuncionario.value = formFuncionario.value;
      });
    }

    // Se o usuário mudar direto na aba, salva também
    meusFuncionario.addEventListener('change', () => {
      try { localStorage.setItem('despesas_funcionario', meusFuncionario.value || ''); } catch (_) {}
    });

    btnAtualizar.addEventListener('click', () => this.carregarMeusLancamentos());

    btnLimpar.addEventListener('click', () => {
      const inicio = document.getElementById('meusInicio');
      const fim = document.getElementById('meusFim');
      if (inicio) inicio.value = '';
      if (fim) fim.value = '';
      this.carregarMeusLancamentos();
    });
  }

  formatarMoedaBR(valor) {
    const num = Number(valor || 0);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Busca e renderiza
  async carregarMeusLancamentos() {
    const funcionario = document.getElementById('meusFuncionario')?.value || '';
    const inicio = document.getElementById('meusInicio')?.value || '';
    const fim = document.getElementById('meusFim')?.value || '';

    const listaEl = document.getElementById('meusLista');
    const vazioEl = document.getElementById('meusVazio');
    const totalEl = document.getElementById('meusTotal');
    const qtdEl = document.getElementById('meusQtd');
    const pendEl = document.getElementById('meusPendentes');

    if (!listaEl || !vazioEl || !totalEl || !qtdEl || !pendEl) return;

    listaEl.innerHTML = '';
    vazioEl.style.display = 'none';
    totalEl.textContent = 'Total: R$ 0,00';
    qtdEl.textContent = 'Itens: 0';
    pendEl.textContent = 'Pendentes: 0';

    if (!funcionario) {
      vazioEl.style.display = 'block';
      return;
    }

    try {
      let q = window.db.collection('despesas').where('funcionario', '==', funcionario);

      // data é string ISO yyyy-mm-dd, então range funciona bem
      if (inicio) q = q.where('data', '>=', inicio);
      if (fim) q = q.where('data', '<=', fim);

      // Ordena por data (string ISO)
      q = q.orderBy('data', 'desc').limit(200);

      const snap = await q.get();

      if (snap.empty) {
        vazioEl.style.display = 'block';
        return;
      }

      let total = 0;
      let pendentes = 0;
      let qtd = 0;

const docs = snap.docs || [];
const exibidos = docs.slice(0, LIMITE_PADRAO_MEUS);

exibidos.forEach((doc) => {
  const d = doc.data() || {};
  qtd += 1;
  total += Number(d.valor || 0);
  if ((d.status || 'pendente') === 'pendente') pendentes += 1;

  const badgeClass = (d.status || 'pendente').toLowerCase();
  const tipo = d.tipo || '—';
  const projeto = d.projeto || '—';
  const data = d.data || '—';
  const descricao = (d.descricao || '').trim();
  const valor = this.formatarMoedaBR(d.valor || 0);

  const comprovanteLink = d.comprovanteUrl
    ? `<a class="link-btn" href="${d.comprovanteUrl}" target="_blank" rel="noopener noreferrer"><i class="fas fa-paperclip"></i> Comprovante</a>`
    : '';

  const card = document.createElement('div');
  card.className = 'expense-card';
  card.innerHTML = `
    <div class="expense-top">
      <div class="expense-title">${tipo} • ${valor}</div>
      <div class="badge ${badgeClass}">${d.status || 'pendente'}</div>
    </div>
    <div class="expense-meta">
      <span><i class="fas fa-briefcase"></i> ${projeto}</span>
      <span><i class="fas fa-calendar"></i> ${data}</span>
    </div>
    ${descricao ? `<div class="expense-desc">${this.escapeHtml(descricao)}</div>` : ''}
    <div class="expense-actions">
      ${comprovanteLink}
      <button type="button" class="link-btn" data-docid="${doc.id}"><i class="fas fa-copy"></i> Copiar ID</button>
    </div>
  `;

  // Copiar ID sem depender de permissões extras
  const btnCopy = card.querySelector('button[data-docid]');
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(doc.id);
        this.mostrarNotificacao('✅ ID copiado!', 'success');
      } catch (e) {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = doc.id;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        this.mostrarNotificacao('✅ ID copiado!', 'success');
      }
    });
  }

  listaEl.appendChild(card);
});

if (docs.length > LIMITE_PADRAO_MEUS) {
  this.mostrarNotificacao(
    `Mostrando os ${LIMITE_PADRAO_MEUS} lançamentos mais recentes. Use o filtro de data para ver mais.`,
    'info'
  );
}}

        listaEl.appendChild(card);
      });

      totalEl.textContent = `Total: ${this.formatarMoedaBR(total)}`;
      qtdEl.textContent = `Itens: ${qtd}`;
      pendEl.textContent = `Pendentes: ${pendentes}`;

    } catch (err) {
      console.error('❌ Erro ao carregar meus lançamentos:', err);
      this.mostrarNotificacao('❌ Não consegui carregar sua lista. ' + (err?.message || ''), 'error');
      vazioEl.style.display = 'block';
    }
  }

  escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // ============================================
  // UTILITÁRIOS
  // ============================================
  setDataAtual() {
    const dataInput = document.getElementById('data');
    if (dataInput) dataInput.valueAsDate = new Date();
  }

  aplicarMascaraMonetaria(input) {
    let valor = input.value.replace(/\D/g, '');
    
    if (valor.length === 0) {
      input.value = '';
      return;
    }
  
    let num = parseInt(valor);
    
    // ✅ CORREÇÃO: Não limpa se for 0, permite que o usuário continue digitando
    if (num === 0) {
      input.value = '0,00';
      return;
    }
  
    let valorFormatado = (num / 100).toFixed(2);
    
    // ✅ Formata como moeda BR
    input.value = parseFloat(valorFormatado).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }


  formatarValor(input) {
    // Se o campo estiver vazio, não faz nada
    if (!input.value || input.value.trim() === '') return;
  
    // Remove a formatação atual para análise
    let valor = input.value.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(valor);
  
    // ✅ CORREÇÃO: Só limpa se for realmente NaN, não se for 0 ou valor válido
    if (isNaN(num)) {
      input.value = '';
      return;
    }
  
    // ✅ Se for 0, formata como R$ 0,00 em vez de limpar
    if (num === 0) {
      input.value = num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return;
    }
  
    // ✅ Para valores válidos, mantém a formatação BR
    input.value = num.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  parseValor(valorString) {
    if (!valorString) return 0;
    // Remove "R$", espaços, e substitui a vírgula (separador decimal BR) por ponto (separador decimal JS)
    let valor = valorString.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(valor);
    return isNaN(num) ? 0 : num;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ============================================
  // PREVIEW DE COMPROVANTE
  // ============================================
  previewComprovante(file) {
    const preview = document.getElementById('comprovantePreview');
    if (!file) return preview.innerHTML = '';

    if (!this.CONFIG.acceptedFileTypes.includes(file.type)) {
      this.mostrarNotificacao('⚠️ Tipo de arquivo não aceito.', 'error');
      return;
    }
    if (file.size > this.CONFIG.maxFileSize) {
      this.mostrarNotificacao('⚠️ Arquivo muito grande. Máximo 10MB.', 'error');
      return;
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        preview.innerHTML = `
          <div class="preview-image">
            <img src="${e.target.result}" alt="Preview do comprovante">
            <small><i class="fas fa-check-circle"></i> ${file.name} (${this.formatFileSize(file.size)})</small>
          </div>`;
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      preview.innerHTML = `
        <div class="preview-file">
          <i class="fas fa-file-pdf"></i>
          <small><i class="fas fa-check-circle"></i> ${file.name} (${this.formatFileSize(file.size)})</small>
        </div>`;
    }
  }

  // ============================================
  // UPLOAD COMPROVANTE (corrigido para usar window.storage)
  // ============================================
  async uploadComprovante(file) {
    if (!window.storage) throw new Error('Storage não inicializado');
    const timestamp = Date.now();
    const nomeArquivo = `comprovantes/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    console.log('📤 Upload ->', nomeArquivo);

    const fileRef = window.storage.ref().child(nomeArquivo);
    const uploadTask = fileRef.put(file, { contentType: file.type });

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snap) => {
          const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
          console.log(`📊 Upload ${progress.toFixed(1)}% completo`);
        },
        (error) => {
          console.error('❌ Erro no upload:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await fileRef.getDownloadURL();
          console.log('✅ Upload concluído:', downloadURL);
          resolve(downloadURL);
        }
      );
    });
  }

  // ============================================
  // SALVAR DESPESA (corrigido para usar window.db)
  // ============================================
  async salvarDespesa() {
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;

    try {
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      submitBtn.disabled = true;

      const despesaData = {
        projeto: document.getElementById('projeto').value,
        funcionario: document.getElementById('funcionario').value,
        data: document.getElementById('data').value,
        tipo: document.getElementById('tipo').value,
        descricao: document.getElementById('descricao').value.trim(),
        valor: this.parseValor(document.getElementById('valor').value),
        status: 'pendente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!this.validarFormulario(despesaData)) return;

      const comprovanteFile = document.getElementById('comprovante').files[0];
      if (comprovanteFile) {
        const url = await this.uploadComprovante(comprovanteFile);
        despesaData.comprovanteUrl = url;
        despesaData.comprovanteNome = comprovanteFile.name;
        despesaData.comprovanteSize = comprovanteFile.size;
        despesaData.comprovanteType = comprovanteFile.type;
      }

      console.log('💾 Salvando no Firestore...');
      const docRef = await window.db.collection('despesas').add(despesaData);
      console.log('✅ Despesa salva com ID:', docRef.id);

      // Lembra o funcionário para facilitar a aba "Meus lançamentos"
      try { localStorage.setItem('despesas_funcionario', despesaData.funcionario || ''); } catch (_) {}

      this.mostrarNotificacao('✅ Despesa registrada com sucesso!', 'success');
      this.limparFormulario();

      // Se a aba "Meus lançamentos" estiver aberta, atualiza a lista
      try {
        const tabMeus = document.getElementById('tabMeus');
        if (tabMeus && tabMeus.classList.contains('active')) this.carregarMeusLancamentos();
      } catch (_) {}

    } catch (err) {
      console.error('❌ Erro ao salvar despesa:', err);
      this.mostrarNotificacao('❌ Erro ao salvar despesa: ' + err.message, 'error');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  validarFormulario(data) {
    const camposObrigatorios = { projeto: 'Projeto', funcionario: 'Funcionário', data: 'Data', tipo: 'Tipo' };
    for (const [campo, nome] of Object.entries(camposObrigatorios)) {
      if (!data[campo]) {
        this.mostrarNotificacao(`⚠️ Preencha o campo: ${nome}`, 'error');
        document.getElementById(campo)?.focus();
        return false;
      }
    }
    if (!data.valor || data.valor <= 0) {
      this.mostrarNotificacao('⚠️ Informe um valor válido', 'error');
      return false;
    }
    return true;
  }

  limparFormulario() {
    document.getElementById('formDespesa').reset();
    document.getElementById('comprovantePreview').innerHTML = '';
    this.setDataAtual();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  mostrarNotificacao(mensagem, tipo) {
    const notif = document.createElement('div');
    notif.className = `notification ${tipo}`;
    notif.innerHTML = `<span>${mensagem}</span><button onclick="this.parentElement.remove()">×</button>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 5000);
  }
}

// ============================================
// INICIALIZAÇÃO GLOBAL
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  window.despesasApp = new DespesasApp();
  console.log('✅ App de Despesas inicializado globalmente');
});






