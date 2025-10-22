// Configurações fixas
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

// Sistema de Despesas
class DespesasManager {
  constructor() {
    this.init();
  }

  async init() {
    this.carregarConfiguracoes();
    this.verificarConexao();
    this.configurarEventListeners();
  }

  carregarConfiguracoes() {
    carregarDropdown('projeto', CONFIG.projetos);
    carregarDropdown('nome', CONFIG.funcionarios);
    carregarDropdown('tipo_despesa', CONFIG.tiposDespesa);
    document.getElementById('data').valueAsDate = new Date();
  }

  configurarEventListeners() {
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
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.processarFormulario();
    });
  }

  async processarFormulario() {
    const formData = new FormData(document.getElementById('expenseForm'));
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

      console.log('Dados da despesa:', despesaData);

      // PRIMEIRO: Upload do comprovante se existir
      const anexoInput = document.getElementById('anexo');
      let comprovanteUrl = '';
      
      if (anexoInput.files.length > 0) {
        console.log('Tem arquivo para upload');
        comprovanteUrl = await this.uploadComprovante(
          anexoInput.files[0], 
          despesaData.nome
        );
        console.log('Comprovante URL:', comprovanteUrl);
      }

      // SEGUNDO: Enviar para Web App (Planilha + Drive)
      console.log('Enviando para Web App...');
      const webAppResult = await this.enviarParaWebApp({
        ...despesaData,
        comprovanteUrl: comprovanteUrl
      });
      console.log('Resposta Web App:', webAppResult);

      // TERCEIRO: Salvar no Firebase (backup)
      console.log('Salvando no Firebase...');
      const resultFirebase = await this.salvarDespesaFirebase({
        ...despesaData,
        comprovanteUrl
      });

      this.mostrarMensagem('✅ Despesa registrada com sucesso! Dados salvos na planilha e no sistema.', 'success');
      this.limparFormulario();

    } catch (error) {
      console.error('Erro completo:', error);
      this.mostrarMensagem('❌ Erro ao salvar despesa: ' + error.message, 'error');
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  }

  async salvarDespesaFirebase(despesaData) {
    try {
      // Converter valor para numérico
      const valorNumerico = parseFloat(
        despesaData.valor.replace('R$', '')
          .replace(/\./g, '')
          .replace(',', '.')
          .trim()
      );

      // Salvar no Firebase Firestore
      const docRef = await db.collection('despesas').add({
        projeto: despesaData.projeto,
        nome: despesaData.nome,
        data: despesaData.data,
        tipo_despesa: despesaData.tipo_despesa,
        descricao: despesaData.descricao,
        valor: valorNumerico,
        comprovanteUrl: despesaData.comprovanteUrl,
        status: 'pendente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, id: docRef.id, message: 'Despesa salva no Firebase!' };
    } catch (error) {
      console.error('Erro ao salvar no Firebase:', error);
      throw error;
    }
  }

  async enviarParaWebApp(despesaData) {
    try {
      console.log('Enviando dados para Web App:', despesaData);
      
      const response = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(despesaData)
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('Web App respondeu:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Erro no Web App');
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao enviar para Web App:', error);
      throw new Error('Falha na comunicação com a planilha: ' + error.message);
    }
  }

  async uploadComprovante(arquivo, nomeFuncionario) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async function(e) {
        try {
          console.log('Iniciando upload do comprovante...');
          
          const formData = new FormData();
          formData.append('acao', 'upload');
          formData.append('nome', nomeFuncionario);
          formData.append('anexo', arquivo);

          const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Erro HTTP no upload: ${response.status}`);
          }

          const result = await response.json();
          console.log('Upload resposta:', result);
          
          if (result.success && result.url) {
            resolve(result.url);
          } else {
            reject(new Error(result.message || 'Erro no upload'));
          }
        } catch (error) {
          console.error('Erro no upload:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(arquivo);
    });
  }

  verificarConexao() {
    const mostrarStatus = (online) => {
      let statusBar = document.getElementById('status-offline');
      if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.id = 'status-offline';
        statusBar.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 12px;
          text-align: center;
          font-weight: 600;
          z-index: 10000;
          animation: slideDown 0.3s ease;
        `;
        document.body.appendChild(statusBar);
      }

      if (online) {
        statusBar.textContent = '✅ Conectado';
        statusBar.style.backgroundColor = '#4caf50';
        statusBar.style.color = 'white';
        statusBar.style.display = 'block';
        setTimeout(() => statusBar.style.display = 'none', 3000);
      } else {
        statusBar.textContent = '📱 Modo Offline - Dados salvos localmente';
        statusBar.style.backgroundColor = '#ff9800';
        statusBar.style.color = 'white';
        statusBar.style.display = 'block';
      }
    };

    mostrarStatus(navigator.onLine);
    window.addEventListener('online', () => mostrarStatus(true));
    window.addEventListener('offline', () => mostrarStatus(false));
  }

  mostrarMensagem(mensagem, tipo) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = mensagem;
    messageDiv.className = `message ${tipo}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }

  limparFormulario() {
    document.getElementById('expenseForm').reset();
    document.getElementById('preview').style.display = 'none';
    document.getElementById('data').valueAsDate = new Date();
    document.getElementById('descricao-group').style.display = 'none';
  }
}

// Funções auxiliares
function carregarDropdown(elementId, opcoes) {
  const select = document.getElementById(elementId);
  // Limpar opções existentes exceto a primeira
  while (select.children.length > 1) {
    select.removeChild(select.lastChild);
  }
  
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

// Funções globais
function capturePhoto() {
  document.getElementById('anexo').click();
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  new DespesasManager();
});
