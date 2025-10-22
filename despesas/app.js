// Configurações fixas (substitui o google.script.run)
const CONFIG = {
  projetos: ['BR-135/BA', 'Panra Diamantina', 'Habilis-GO'],
  funcionarios: ['Gleisson', 'Júlio', 'Samuel', 'Tiago', 'Yuri'],
  tiposDespesa: [
    'Água', 'Almoço / Jantar', 'Aluguel de Carro', 'Café da Manhã', 
    'Combustível', 'Correios', 'EPI', 'Ferramentas', 'Hospedagem / Hotel', 
    'Lanche / Refeição Leve', 'Lavagem do Veículo', 'Manutenção de Equipamento', 
    'Material de Escritório', 'Passagens', 'Pedágio', 'Táxi / Uber / Aplicativos', 
    'Outros'
  ]
};

// Sistema Offline com Firebase
class DespesasManager {
  constructor() {
    this.init();
  }

  async init() {
    this.carregarConfiguracoes();
    this.verificarConexao();
  }

  carregarConfiguracoes() {
    carregarDropdown('projeto', CONFIG.projetos);
    carregarDropdown('nome', CONFIG.funcionarios);
    carregarDropdown('tipo_despesa', CONFIG.tiposDespesa);
    document.getElementById('data').valueAsDate = new Date();
  }

  async salvarDespesa(despesaData) {
    try {
      // Salvar no Firebase Firestore
      const docRef = await db.collection('despesas').add({
        ...despesaData,
        valor: parseFloat(despesaData.valor.replace('R$', '').replace('.', '').replace(',', '.').trim()),
        status: 'pendente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, id: docRef.id, message: 'Despesa salva com sucesso!' };
    } catch (error) {
      console.error('Erro ao salvar no Firebase:', error);
      throw error;
    }
  }

  async uploadComprovante(arquivo, nomeFuncionario) {
    const formData = new FormData();
    formData.append('anexo', arquivo);
    formData.append('nome', nomeFuncionario);
    formData.append('acao', 'upload');

    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    return result.url || '';
  }

  verificarConexao() {
    const mostrarStatus = (online) => {
      let statusBar = document.getElementById('status-offline');
      if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.id = 'status-offline';
        document.body.appendChild(statusBar);
      }

      if (online) {
        statusBar.textContent = '✅ Conectado';
        statusBar.style.backgroundColor = '#4caf50';
        statusBar.style.display = 'block';
        setTimeout(() => statusBar.style.display = 'none', 3000);
      } else {
        statusBar.textContent = '📱 Modo Offline - Dados salvos localmente';
        statusBar.style.backgroundColor = '#ff9800';
        statusBar.style.display = 'block';
      }
    };

    mostrarStatus(navigator.onLine);
    window.addEventListener('online', () => mostrarStatus(true));
    window.addEventListener('offline', () => mostrarStatus(false));
  }
}

// Inicializar gerenciador
const despesasManager = new DespesasManager();

// Funções auxiliares
function carregarDropdown(elementId, opcoes) {
  const select = document.getElementById(elementId);
  opcoes.forEach(opcao => {
    const option = document.createElement('option');
    option.value = opcao;
    option.textContent = opcao;
    select.appendChild(option);
  });
}

function formatarMoeda(input) {
  let value = input.value.replace(/\D/g, '');
  value = (value / 100).toFixed(2);
  value = 'R$ ' + value.replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.');
  input.value = value;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Máscara monetária
  document.getElementById('valor').addEventListener('blur', function(e) {
    formatarMoeda(e.target);
  });

  document.getElementById('valor').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0) {
      e.target.value = 'R$ ' + (value / 100).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.');
    }
  });

  // Mostrar/ocultar descrição
  document.getElementById('tipo_despesa').addEventListener('change', function(e) {
    const descricaoGroup = document.getElementById('descricao-group');
    const descricaoInput = document.getElementById('descricao');
    
    if (e.target.value === 'Outros') {
      descricaoGroup.style.display = 'block';
      descricaoInput.required = true;
    } else {
      descricaoGroup.style.display = 'none';
      descricaoInput.required = false;
      descricaoInput.value = '';
    }
  });

  // Preview da imagem
  document.getElementById('anexo').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const preview = document.getElementById('preview');
        preview.src = e.target.result;
        preview.style.display = 'block';
      }
      reader.readAsDataURL(file);
    }
  });

  // Submit do formulário
  document.getElementById('expenseForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const button = document.getElementById('submitBtn');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    button.disabled = true;

    try {
      const despesaData = {
        projeto: formData.get('projeto'),
        nome: formData.get('nome'),
        data: formData.get('data'),
        tipo_despesa: formData.get('tipo_despesa'),
        descricao: formData.get('descricao') || '',
        valor: formData.get('valor')
      };

      // Upload do comprovante se existir
      const anexoInput = document.getElementById('anexo');
      let comprovanteUrl = '';
      
      if (anexoInput.files.length > 0) {
        comprovanteUrl = await despesasManager.uploadComprovante(
          anexoInput.files[0], 
          despesaData.nome
        );
      }

      // Salvar no Firebase
      const result = await despesasManager.salvarDespesa({
        ...despesaData,
        comprovanteUrl
      });

      mostrarMensagem(result.message, 'success');
      limparFormulario();

    } catch (error) {
      console.error('Erro:', error);
      mostrarMensagem('Erro ao salvar despesa: ' + error.message, 'error');
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  });
});

function mostrarMensagem(mensagem, tipo) {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = mensagem;
  messageDiv.className = `message ${tipo}`;
  messageDiv.style.display = 'block';
  
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 5000);
}

function limparFormulario() {
  document.getElementById('expenseForm').reset();
  document.getElementById('preview').style.display = 'none';
  document.getElementById('data').valueAsDate = new Date();
  document.getElementById('descricao-group').style.display = 'none';
  localStorage.removeItem('rascunhoDespesa');
}

// Funções de câmera
function capturePhoto() {
  document.getElementById('anexo').click();
}