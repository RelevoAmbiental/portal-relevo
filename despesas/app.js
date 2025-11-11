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
      projetos: ['BR-135/BA', 'Parna Diamantina', 'Habilis-GO'],
      funcionarios: ['Gleisson', 'Júlio', 'Samuel', 'Tiago', 'Yuri', 'João', 'Danilo', 'Roberto', 'Daniel'],
      tiposDespesa: [
        'Água', 'Almoço / Jantar', 'Aluguel de Carro', 'Café da Manhã',
        'Combustível', 'Correios', 'EPI', 'Ferramentas', 'Hospedagem / Hotel',
        'Lanche / Refeição Leve', 'Lavagem do Veículo', 'Manutenção de Equipamento',
        'Material de Escritório', 'Passagens', 'Pedágio', 'Táxi / Uber / Aplicativos', 'Outros'
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
    valorInput.addEventListener('blur', (e) => this.formatarValor(e.target));
    valorInput.addEventListener('input', (e) => this.permitirApenasNumeros(e.target));
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
  // UTILITÁRIOS
  // ============================================
  setDataAtual() {
    const dataInput = document.getElementById('data');
    if (dataInput) dataInput.valueAsDate = new Date();
  }

  permitirApenasNumeros(input) {
    input.value = input.value.replace(/\D/g, '');
  }

  formatarValor(input) {
    let valor = input.value.replace(/\D/g, '');
    if (!valor) { input.value = ''; return; }
    valor = (parseInt(valor) / 100).toFixed(2);
    input.value = 'R$ ' + valor.replace('.', ',');
  }

  parseValor(valorString) {
    if (!valorString) return 0;
    let valor = valorString.replace('R$', '').replace(/\s/g, '').replace(',', '.');
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

      this.mostrarNotificacao('✅ Despesa registrada com sucesso!', 'success');
      this.limparFormulario();

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
