// despesas/app.js - VERSÃO SEM AUTENTICAÇÃO
class DespesasApp {
    constructor() {
        // Configurações fixas - FÁCIL DE MODIFICAR
        this.CONFIG = {
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

        this.init();
        this.setupEventListeners();
    }

    init() {
        // Inicializar selects com as configurações
        this.carregarProjetos();
        this.carregarFuncionarios();
        this.carregarTiposDespesa();
        
        // Configurar data atual
        document.getElementById('data').valueAsDate = new Date();
        
        console.log('Sistema de Despesas inicializado - SEM AUTENTICAÇÃO');
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('formDespesa').addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarDespesa();
        });

        // Comprovante change
        document.getElementById('comprovante').addEventListener('change', (e) => {
            this.previewComprovante(e.target.files[0]);
        });

        // Valor formatting
        document.getElementById('valor').addEventListener('blur', (e) => {
            this.formatarValor(e.target);
        });

        // Mobile menu
        document.querySelector('.menu-toggle')?.addEventListener('click', () => {
            this.toggleMobileMenu();
        });
    }

    carregarProjetos() {
        const select = document.getElementById('projeto');
        select.innerHTML = '<option value="">Selecione o projeto</option>';
        
        this.CONFIG.projetos.forEach(projeto => {
            const option = document.createElement('option');
            option.value = projeto;
            option.textContent = projeto;
            select.appendChild(option);
        });
    }

    carregarFuncionarios() {
        const select = document.getElementById('funcionario');
        select.innerHTML = '<option value="">Selecione o funcionário</option>';
        
        this.CONFIG.funcionarios.forEach(funcionario => {
            const option = document.createElement('option');
            option.value = funcionario;
            option.textContent = funcionario;
            select.appendChild(option);
        });
    }

    carregarTiposDespesa() {
        const select = document.getElementById('tipo');
        select.innerHTML = '<option value="">Selecione o tipo</option>';
        
        this.CONFIG.tiposDespesa.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            select.appendChild(option);
        });
    }

    formatarValor(input) {
        let valor = input.value.replace(/\D/g, '');
        if (valor === '') {
            input.value = '';
            return;
        }
        valor = (parseInt(valor) / 100).toFixed(2);
        input.value = 'R$ ' + valor.replace('.', ',');
    }

    previewComprovante(file) {
        const preview = document.getElementById('comprovantePreview');
        
        if (file) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `
                        <div class="preview-image">
                            <img src="${e.target.result}" alt="Preview do comprovante">
                            <small>${file.name}</small>
                        </div>
                    `;
                };
                reader.readAsDataURL(file);
            } else {
                preview.innerHTML = `
                    <div class="preview-file">
                        <i class="fas fa-file"></i>
                        <small>${file.name}</small>
                    </div>
                `;
            }
        } else {
            preview.innerHTML = '';
        }
    }

    async salvarDespesa() {
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            submitBtn.disabled = true;

            // Coletar dados do formulário
            const despesaData = {
                projeto: document.getElementById('projeto').value,
                funcionario: document.getElementById('funcionario').value,
                data: document.getElementById('data').value,
                tipo: document.getElementById('tipo').value,
                descricao: document.getElementById('descricao').value,
                valor: this.parseValor(document.getElementById('valor').value),
                status: 'pendente',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Validar dados
            if (!this.validarFormulario(despesaData)) {
                return;
            }

            // Upload do comprovante se existir
            const comprovanteFile = document.getElementById('comprovante').files[0];
            if (comprovanteFile) {
                const comprovanteUrl = await this.uploadComprovante(comprovanteFile);
                despesaData.comprovanteUrl = comprovanteUrl;
                despesaData.comprovanteNome = comprovanteFile.name;
            }

            // Salvar no Firestore
            const docRef = await db.collection('despesas').add(despesaData);
            
            console.log('Despesa salva com ID:', docRef.id);
            this.mostrarSucesso('Despesa registrada com sucesso!');
            this.limparFormulario();

        } catch (error) {
            console.error('Erro ao salvar despesa:', error);
            this.mostrarErro('Erro ao salvar despesa. Tente novamente.');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    validarFormulario(data) {
        const camposObrigatorios = ['projeto', 'funcionario', 'data', 'tipo'];
        
        for (let campo of camposObrigatorios) {
            if (!data[campo]) {
                this.mostrarErro(`Por favor, preencha o campo: ${this.formatarNomeCampo(campo)}`);
                document.getElementById(campo)?.focus();
                return false;
            }
        }

        if (!data.valor || data.valor <= 0) {
            this.mostrarErro('Por favor, informe um valor válido');
            document.getElementById('valor').focus();
            return false;
        }

        return true;
    }

    formatarNomeCampo(campo) {
        const nomes = {
            'projeto': 'Projeto',
            'funcionario': 'Funcionário', 
            'data': 'Data',
            'tipo': 'Tipo de Despesa',
            'valor': 'Valor'
        };
        return nomes[campo] || campo;
    }

    parseValor(valorString) {
        if (!valorString) return 0;
        return parseFloat(valorString.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    }

    async uploadComprovante(file) {
        try {
            // Criar nome único para o arquivo - SEM user ID
            const timestamp = Date.now();
            const nomeArquivo = `comprovantes/${timestamp}_${file.name}`;
            
            // Fazer upload para Firebase Storage
            const storageRef = storage.ref();
            const fileRef = storageRef.child(nomeArquivo);
            const snapshot = await fileRef.put(file);
            
            // Obter URL de download
            const downloadURL = await snapshot.ref.getDownloadURL();
            console.log('Comprovante salvo:', downloadURL);
            
            return downloadURL;
        } catch (error) {
            console.error('Erro no upload do comprovante:', error);
            throw new Error('Falha no upload do comprovante');
        }
    }

    mostrarSucesso(mensagem) {
        this.showNotification(mensagem, 'success');
    }

    mostrarErro(mensagem) {
        this.showNotification(mensagem, 'error');
    }

    showNotification(mensagem, tipo) {
        const notifAnterior = document.querySelector('.notification');
        if (notifAnterior) {
            notifAnterior.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.innerHTML = `
            <span>${mensagem}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    limparFormulario() {
        document.getElementById('formDespesa').reset();
        document.getElementById('comprovantePreview').innerHTML = '';
        document.getElementById('data').valueAsDate = new Date();
    }

    toggleMobileMenu() {
        const nav = document.querySelector('nav');
        nav.classList.toggle('active');
    }
}

// Função global para captura de foto
function capturePhoto() {
    document.getElementById('comprovante').click();
}

// Inicializar app quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.despesasApp = new DespesasApp();
});
