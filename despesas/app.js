// ✅ Configurações Globais
const LIMITE_PADRAO_MEUS = 10;

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
    console.log('🚀 Inicializando App...');
    if (!window.db || !window.storage) {
      console.error('❌ Firebase não detectado!');
      alert('Erro de conexão. Verifique se o firebase-config.js está correto.');
      return;
    }

    this.carregarSelects();
    this.setDataAtual();
    this.setupEventListeners();
    this.setupTabs();
    this.setupMeusLancamentos();
  }

  setupEventListeners() {
    const form = document.getElementById('formDespesa');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.salvarDespesa();
      });
    }

    const comprovante = document.getElementById('comprovante');
    if (comprovante) {
      comprovante.addEventListener('change', (e) => this.previewComprovante(e.target.files[0]));
    }

    const valorInput = document.getElementById('valor');
    if (valorInput) {
      valorInput.addEventListener('input', (e) => this.aplicarMascaraMonetaria(e.target));
      valorInput.addEventListener('blur', (e) => this.formatarValor(e.target));
    }
  }

  // ============================================
  // INTERFACE (SELECTS E ABAS)
  // ============================================
  carregarSelects() {
    this.carregarOptions('projeto', this.CONFIG.projetos);
    this.carregarOptions('funcionario', this.CONFIG.funcionarios);
    this.carregarOptions('tipo', this.CONFIG.tiposDespesa);
    this.carregarOptions('meusFuncionario', this.CONFIG.funcionarios);
  }

  carregarOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>';
    options.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt;
      el.textContent = opt;
      select.appendChild(el);
    });
  }

  setDataAtual() {
    const dataInput = document.getElementById('data');
    if (dataInput) dataInput.valueAsDate = new Date();
  }

  setupTabs() {
    const btnRegistro = document.getElementById('tabBtnRegistro');
    const btnMeus = document.getElementById('tabBtnMeus');
    const tabRegistro = document.getElementById('tabRegistro');
    const tabMeus = document.getElementById('tabMeus');

    if (!btnRegistro || !btnMeus) return;

    const ativar = (qual) => {
      const isRegistro = qual === 'registro';
      btnRegistro.classList.toggle('active', isRegistro);
      btnMeus.classList.toggle('active', !isRegistro);
      tabRegistro.classList.toggle('active', isRegistro);
      tabMeus.classList.toggle('active', !isRegistro);

      if (!isRegistro) this.carregarMeusLancamentos();
    };

    btnRegistro.addEventListener('click', () => ativar('registro'));
    btnMeus.addEventListener('click', () => ativar('meus'));
  }

  // ============================================
  // ABA MEUS LANÇAMENTOS (COM FILTRO CORRIGIDO)
  // ============================================
  setupMeusLancamentos() {
    const meusFuncionario = document.getElementById('meusFuncionario');
    const btnAtualizar = document.getElementById('btnMeusAtualizar');
    const btnLimpar = document.getElementById('btnMeusLimpar');

    const salvo = localStorage.getItem('despesas_funcionario');
    if (salvo && meusFuncionario) meusFuncionario.value = salvo;

    if (btnAtualizar) btnAtualizar.addEventListener('click', () => this.carregarMeusLancamentos());
    if (btnLimpar) {
      btnLimpar.addEventListener('click', () => {
        document.getElementById('meusInicio').value = '';
        document.getElementById('meusFim').value = '';
        this.carregarMeusLancamentos();
      });
    }
  }

  async carregarMeusLancamentos() {
    const funcionario = document.getElementById('meusFuncionario')?.value;
    const inicio = document.getElementById('meusInicio')?.value;
    const fim = document.getElementById('meusFim')?.value;
    
    const listaEl = document.getElementById('meusLista');
    const vazioEl = document.getElementById('meusVazio');
    
    if (!listaEl || !funcionario) {
      if (vazioEl) vazioEl.style.display = 'block';
      return;
    }

    listaEl.innerHTML = '<div class="loading">Carregando despesas...</div>';
    vazioEl.style.display = 'none';

    try {
      let q = window.db.collection('despesas').where('funcionario', '==', funcionario);
      
      if (inicio) q = q.where('data', '>=', inicio);
      if (fim) q = q.where('data', '<=', fim);

      const snap = await q.orderBy('data', 'desc').limit(200).get();

      listaEl.innerHTML = '';
      if (snap.empty) {
        vazioEl.style.display = 'block';
        return;
      }

      let total = 0, pendentes = 0;
      
      // ✅ Se usar filtro de data, mostra tudo. Se não, limita a 10.
      const temFiltro = (inicio || fim);
      const docsExibidos = temFiltro ? snap.docs : snap.docs.slice(0, LIMITE_PADRAO_MEUS);

      docsExibidos.forEach(doc => {
        const d = doc.data();
        total += Number(d.valor || 0);
        if (d.status === 'pendente') pendentes += 1;

        const card = document.createElement('div');
        card.className = 'expense-card';
        card.innerHTML = `
          <div class="expense-top">
            <div class="expense-title">${d.tipo} • ${this.formatarMoedaBR(d.valor)}</div>
            <div class="badge ${(d.status || 'pendente').toLowerCase()}">${d.status || 'pendente'}</div>
          </div>
          <div class="expense-meta">
            <span><i class="fas fa-briefcase"></i> ${d.projeto}</span>
            <span><i class="fas fa-calendar"></i> ${d.data}</span>
          </div>
          ${d.descricao ? `<div class="expense-desc">${this.escapeHtml(d.descricao)}</div>` : ''}
          <div class="expense-actions">
            ${d.comprovanteUrl ? `<a class="link-btn" href="${d.comprovanteUrl}" target="_blank">Ver Anexo</a>` : ''}
            <button type="button" class="link-btn btn-copy" data-id="${doc.id}">Copiar ID</button>
          </div>
        `;
        
        card.querySelector('.btn-copy').onclick = () => {
          navigator.clipboard.writeText(doc.id);
          this.mostrarNotificacao('ID Copiado!', 'success');
        };

        listaEl.appendChild(card);
      });

      document.getElementById('meusTotal').textContent = `Total: ${this.formatarMoedaBR(total)}`;
      document.getElementById('meusQtd').textContent = `Itens: ${docsExibidos.length}`;
      document.getElementById('meusPendentes').textContent = `Pendentes: ${pendentes}`;

    } catch (err) {
      console.error(err);
      this.mostrarNotificacao('Erro ao buscar dados. Verifique os índices do Firebase.', 'error');
    }
  }

  // ============================================
  // SALVAR E FORMATAR
  // ============================================
  async salvarDespesa() {
    const btn = document.getElementById('submitBtn');
    try {
      const data = {
        projeto: document.getElementById('projeto').value,
        funcionario: document.getElementById('funcionario').value,
        data: document.getElementById('data').value,
        tipo: document.getElementById('tipo').value,
        descricao: document.getElementById('descricao').value.trim(),
        valor: this.parseValor(document.getElementById('valor').value),
        status: 'pendente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!this.validarFormulario(data)) return;

      btn.disabled = true;
      btn.innerHTML = 'Salvando...';

      const file = document.getElementById('comprovante').files[0];
      if (file) {
        const ref = window.storage.ref().child(`comprovantes/${Date.now()}_${file.name}`);
        await ref.put(file);
        data.comprovanteUrl = await ref.getDownloadURL();
      }

      await window.db.collection('despesas').add(data);
      localStorage.setItem('despesas_funcionario', data.funcionario);
      
      this.mostrarNotificacao('✅ Despesa salva!', 'success');
      this.limparFormulario();
    } catch (err) {
      this.mostrarNotificacao('❌ Erro ao salvar', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Salvar Despesa';
    }
  }

  aplicarMascaraMonetaria(input) {
    let v = input.value.replace(/\D/g, '');
    v = (Number(v) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    input.value = v === 'R$ 0,00' ? '' : v;
  }

  formatarValor(input) {
    if (!input.value) return;
    input.value = this.formatarMoedaBR(this.parseValor(input.value));
  }

  parseValor(str) {
    return Number(str.replace(/\D/g, '')) / 100;
  }

  formatarMoedaBR(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  validarFormulario(d) {
    if (!d.projeto || !d.funcionario || !d.valor) {
      this.mostrarNotificacao('⚠️ Preencha os campos obrigatórios!', 'error');
      return false;
    }
    return true;
  }

  limparFormulario() {
    document.getElementById('formDespesa').reset();
    document.getElementById('comprovantePreview').innerHTML = '';
    this.setDataAtual();
  }

  mostrarNotificacao(msg, tipo) {
    const n = document.createElement('div');
    n.className = `notification ${tipo}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }

  escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }

  previewComprovante(file) {
    const p = document.getElementById('comprovantePreview');
    if (file) p.innerHTML = `<span>📎 ${file.name} pronta.</span>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.despesasApp = new DespesasApp();
});
