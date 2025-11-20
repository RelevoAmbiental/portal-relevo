
Manus, estou te enviando um arquivo zip que você está autorizado a descompactar e analisar todos os arquivos.
Nessa aplicação tem um modulo de despesas, que carrega uma pequena aplicação web para registro de gastos dos meus funcionários.
Nessa aplicação o campo valor, como no print, não está preenchendo e aparecendo a virgula, não tem aquele preenchimento padrão de dinheiro. Quando eu coloco 250, em vez dele registrar R$ 250,00 ele registra R$ 2,50 e não está me permitindo colocar a virgula manualmente.
Onde e como eu corrijo isso, qual parte do script e em qual documento eu faço essa alteração?
portal-relevo-main.zip
Arquivar · 20.78 MB
Lite
Entendido. Vou descompactar o arquivo portal-relevo-main.zip, analisar o código da aplicação de despesas e identificar o local e a forma correta de corrigir o problema de formatação do campo "Valor (R$)" para que ele aceite a vírgula e registre o valor corretamente (por exemplo, R$ 250,00 em vez de R$ 2,50).
Vou começar descompactando o arquivo.
Ao descompactar o arquivo, vou examinar a estrutura do código para localizar onde o valor do campo de despesas é tratado, buscando ajustar a formatação para aceitar vírgulas e valor correto.

Identifiquei a estrutura do projeto, incluindo o arquivo app.js na pasta despesas. O próximo passo é localizar o código que trata o campo de despesas para ajustar a formatação de valores.

Corrigi as funções de formatação para aceitar vírgula, ponto e permitir entrada de valores monetários corretos, garantindo registro em formato brasileiro (R$ 250,00).

Corrigi as funções de formatação para aceitar vírgula e ponto, garantindo que valores monetários sejam registrados corretamente no formato brasileiro (ex: R$ 250,00). O próximo passo é analisar a estrutura da aplicação.

Lite
O problema de formatação do campo Valor (R$) foi identificado e corrigido no arquivo JavaScript principal da aplicação.
A causa do problema era a lógica de formatação e tratamento de entrada do campo, que estava:
Impedindo a digitação da vírgula (permitirApenasNumeros só permitia dígitos).
Tratando o valor como centavos (a função formatarValor dividia o valor por 100, transformando 250 em 2.50).
A correção foi implementada no arquivo /home/ubuntu/portal-relevo/portal-relevo-main/despesas/app.js através das seguintes alterações:
1. Alterações na Lógica de Entrada e Formatação (app.js)
Função
Alteração
Objetivo
permitirApenasNumeros(input)
Modificada para permitir a vírgula (,) além dos dígitos e garantir que apenas uma vírgula seja digitada.
Permite a entrada de valores decimais no padrão brasileiro.
formatarValor(input)
Substituída por uma lógica que utiliza o método toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}).
Formata o valor corretamente para o padrão monetário brasileiro (ex: 250,00 se torna R$ 250,00), eliminando a divisão por 100 que causava o erro de centavos.
removerFormatacao(input)
Nova função adicionada, chamada no evento focus do campo.
Remove a formatação "R$ " e substitui o ponto por vírgula ao clicar no campo, facilitando a edição do valor pelo usuário.
parseValor(valorString)
Modificada para remover pontos (separadores de milhar) e substituir a vírgula (separador decimal) por ponto antes de converter para float.
Garante que o valor seja salvo no banco de dados (Firebase) como um número decimal correto, independentemente da formatação de exibição.
2. Onde e Como Aplicar a Correção
O arquivo modificado é:
Arquivo: /home/ubuntu/portal-relevo/portal-relevo-main/despesas/app.js
Você deve substituir o seu arquivo app.js original pelo arquivo anexado a esta mensagem.
Com essa alteração, ao digitar 250 e sair do campo, ele será formatado como R$ 250,00. Se você digitar 250,50, ele será formatado como R$ 250,50.
O arquivo app.js corrigido está anexado para sua conveniência. Se precisar de mais alguma ajuda ou tiver outras dúvidas, estou à disposição.
app.js
Código · 10.88 KB

Ver todos os arquivos nesta tarefa
Tarefa concluída
Como foi este resultado?
Sugestões de acompanhamento
Enviar mensagem para Manus

app.js
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
      projetos: ['BR-135/BA', 'EOL Ibitiara/Assurua'],
      funcionarios: ['Gleisson', 'Sandro', 'Emílio', 'Yuri', 'João', 'Danilo', 'Roberto', 'Daniel', 'Tiago', 'Samuel'],
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
    valorInput.addEventListener('focus', (e) => this.removerFormatacao(e.target));
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
    // Permite apenas dígitos e a vírgula (,)
    input.value = input.value.replace(/[^0-9,]/g, '');
    // Garante que haja apenas uma vírgula
    const parts = input.value.split(',');
    if (parts.length > 2) {
      input.value = parts[0] + ',' + parts.slice(1).join('');
    }
  }

  removerFormatacao(input) {
    // Remove "R$ " e substitui a vírgula por ponto para facilitar a entrada
    input.value = input.value.replace('R$ ', '').replace('.', ',');
  }

  formatarValor(input) {
    let valor = input.value.replace('R$ ', '').replace(/\./g, '').replace(',', '.');
    
    // Se o valor for vazio ou apenas um ponto/vírgula, limpa e sai
    if (!valor || valor === '.') {
      input.value = '';
      return;
    }

    // Converte para número. Se não for um número válido, limpa e sai.
    const num = parseFloat(valor);
    if (isNaN(num)) {
      input.value = '';
      return;
    }

    // Formata o número para o padrão monetário brasileiro (R$ X.XXX,XX)
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

