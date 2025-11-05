// ============================================
// APP DE DESPESAS - VERSÃO OTIMIZADA
// Relevo Consultoria Ambiental - 2025
// ============================================

class DespesasApp {
    constructor() {
        // Configurações da aplicação
        this.CONFIG = {
            projetos: ['BR-135/BA', 'Panra Diamantina', 'Habilis-GO'],
            funcionarios: ['Gleisson', 'Júlio', 'Samuel', 'Tiago', 'Yuri'],
            tiposDespesa: [
                'Água',
                'Almoço / Jantar',
                'Aluguel de Carro',
                'Café da Manhã',
                'Combustível',
                'Correios',
                'EPI',
                'Ferramentas',
                'Hospedagem / Hotel',
                'Lanche / Refeição Leve',
                'Lavagem do Veículo',
                'Manutenção de Equipamento',
                'Material de Escritório',
                'Passagens',
                'Pedágio',
                'Táxi / Uber / Aplicativos',
                'Outros'
            ],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            acceptedFileTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
        };

        this.init();
    }

    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    init() {
        console.log('🚀 Inicializando App de Despesas...');
        
        this.carregarSelects();
        this.setDataAtual();
        this.setupEventListeners();
        
        console.log('✅ App de Despesas pronto - Upload HABILITADO');
    }

    // ============================================
    // CONFIGURAR EVENT LISTENERS
    // ============================================
    setupEventListeners() {
        // Submit do formulário
        const form = document.getElementById('formDespesa');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarDespesa();
        });

        // Preview de comprovante
        const comprovante = document.getElementById('comprovante');
        comprovante.addEventListener('change', (e) => {
            this.previewComprovante(e.target.files[0]);
        });

        // Formatação automática de valor
        const valorInput = document.getElementById('valor');
        valorInput.addEventListener('blur', (e) => {
            this.formatarValor(e.target);
        });

        // Permitir apenas números no valor
        valorInput.addEventListener('input', (e) => {
            this.permitirApenasNumeros(e.target);
        });
    }

    // ============================================
    // CARREGAR SELECTS
    // ============================================
    carregarSelects() {
        this.carregarOptions('projeto', this.CONFIG.projetos);
        this.carregarOptions('funcionario', this.CONFIG.funcionarios);
        this.carregarOptions('tipo', this.CONFIG.tiposDespesa);
        console.log('✅ Selects carregados');
    }

    carregarOptions(selectId, options) {
        const select = document.getElementById(selectId);
        if (!select) {
            console.warn(`⚠️ Select ${selectId} não encontrado`);
            return;
        }

        select.innerHTML = '<option value="">Selecione...</option>';
        options.forEach(option => {
            select.innerHTML += `<option value="${option}">${option}</option>`;
        });
    }

    // ============================================
    // DEFINIR DATA ATUAL
    // ============================================
    setDataAtual() {
        const dataInput = document.getElementById('data');
        if (dataInput) {
            dataInput.valueAsDate = new Date();
        }
    }

    // ============================================
    // FORMATAÇÃO DE VALOR
    // ============================================
    permitirApenasNumeros(input) {
        // Remove tudo que não é número
        let valor = input.value.replace(/\D/g, '');
        input.value = valor;
    }

    formatarValor(input) {
        let valor = input.value.replace(/\D/g, '');
        
        if (valor === '' || valor === '0') {
            input.value = '';
            return;
        }
        
        // Converte para formato monetário
        valor = (parseInt(valor) / 100).toFixed(2);
        input.value = 'R$ ' + valor.replace('.', ',');
    }

    parseValor(valorString) {
        if (!valorString) return 0;
        
        try {
            // Remove R$, espaços e trata vírgulas/pontos
            let valorLimpo = valorString
                .replace('R$', '')
                .replace(/\s/g, '')
                .trim();
            
            // Se tem vírgula E ponto, remove pontos (separador de milhares) e troca vírgula por ponto
            if (valorLimpo.includes(',') && valorLimpo.includes('.')) {
                valorLimpo = valorLimpo.replace(/\./g, '').replace(',', '.');
            } 
            // Se tem apenas vírgula, troca por ponto
            else if (valorLimpo.includes(',')) {
                valorLimpo = valorLimpo.replace(',', '.');
            }
            
            const valorNumerico = parseFloat(valorLimpo);
            return isNaN(valorNumerico) ? 0 : valorNumerico;
        } catch (error) {
            console.error('❌ Erro ao parsear valor:', error);
            return 0;
        }
    }

    // ============================================
    // PREVIEW DE COMPROVANTE
    // ============================================
    previewComprovante(file) {
        const preview = document.getElementById('comprovantePreview');
        
        if (!file) {
            preview.innerHTML = '';
            return;
        }

        // Validar tipo de arquivo
        if (!this.CONFIG.acceptedFileTypes.includes(file.type)) {
            this.mostrarNotificacao(
                '⚠️ Tipo de arquivo não aceito. Use imagens (JPG, PNG) ou PDF.',
                'error'
            );
            document.getElementById('comprovante').value = '';
            preview.innerHTML = '';
            return;
        }

        // Validar tamanho
        if (file.size > this.CONFIG.maxFileSize) {
            this.mostrarNotificacao(
                '⚠️ Arquivo muito grande. Máximo 10MB.',
                'error'
            );
            document.getElementById('comprovante').value = '';
            preview.innerHTML = '';
            return;
        }

        // Preview para imagens
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <div class="preview-image">
                        <img src="${e.target.result}" alt="Preview do comprovante">
                        <small>
                            <i class="fas fa-check-circle" style="color: var(--success);"></i>
                            ${file.name} (${this.formatFileSize(file.size)})
                        </small>
                    </div>
                `;
            };
            reader.readAsDataURL(file);
        } 
        // Preview para PDFs
        else if (file.type === 'application/pdf') {
            preview.innerHTML = `
                <div class="preview-file">
                    <i class="fas fa-file-pdf"></i>
                    <small>
                        <i class="fas fa-check-circle" style="color: var(--success);"></i>
                        ${file.name} (${this.formatFileSize(file.size)})
                    </small>
                </div>
            `;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ============================================
    // UPLOAD DE COMPROVANTE
    // ============================================
    async uploadComprovante(file) {
        return new Promise((resolve, reject) => {
            console.log('📤 Iniciando upload para Firebase Storage...');

            // Validar tamanho
            if (file.size > this.CONFIG.maxFileSize) {
                reject(new Error('Arquivo muito grande. Máximo 10MB.'));
                return;
            }

            // Validar tipo
            if (!this.CONFIG.acceptedFileTypes.includes(file.type)) {
                reject(new Error('Tipo de arquivo não aceito.'));
                return;
            }

            // Nome único com timestamp
            const timestamp = Date.now();
            const extensao = file.name.split('.').pop();
            const nomeSeguro = file.name
                .replace(/[^a-zA-Z0-9.]/g, '_')
                .substring(0, 50); // Limitar tamanho do nome
            const nomeArquivo = `comprovantes/${timestamp}_${nomeSeguro}`;
            
            console.log('📁 Upload para:', nomeArquivo);

            // Upload para Firebase Storage
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(nomeArquivo);
            
            const uploadTask = fileRef.put(file, {
                contentType: file.type
            });

            // Monitorar progresso
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`📊 Upload ${progress.toFixed(1)}% completo`);
                },
                (error) => {
                    console.error('❌ Erro no upload:', error);
                    let mensagemErro = 'Falha no upload do comprovante';
                    
                    if (error.code === 'storage/unauthorized') {
                        mensagemErro = 'Sem permissão para fazer upload';
                    } else if (error.code === 'storage/canceled') {
                        mensagemErro = 'Upload cancelado';
                    } else if (error.code === 'storage/unknown') {
                        mensagemErro = 'Erro desconhecido no upload';
                    }
                    
                    reject(new Error(mensagemErro));
                },
                async () => {
                    try {
                        // Upload completo, obter URL
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        console.log('✅ Upload concluído:', downloadURL);
                        resolve(downloadURL);
                    } catch (urlError) {
                        console.error('❌ Erro ao obter URL:', urlError);
                        reject(new Error('Falha ao obter URL do arquivo'));
                    }
                }
            );
        });
    }

    // ============================================
    // VALIDAR FORMULÁRIO
    // ============================================
    validarFormulario(data) {
        const camposObrigatorios = {
            'projeto': 'Projeto',
            'funcionario': 'Funcionário',
            'data': 'Data',
            'tipo': 'Tipo de Despesa'
        };
        
        // Verificar campos obrigatórios
        for (let [campo, nome] of Object.entries(camposObrigatorios)) {
            if (!data[campo]) {
                this.mostrarNotificacao(`⚠️ Preencha o campo: ${nome}`, 'error');
                const elemento = document.getElementById(campo);
                if (elemento) {
                    elemento.focus();
                    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return false;
            }
        }

        // Verificar valor
        if (!data.valor || data.valor <= 0) {
            this.mostrarNotificacao('⚠️ Informe um valor válido', 'error');
            const valorInput = document.getElementById('valor');
            if (valorInput) {
                valorInput.focus();
                valorInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }

        return true;
    }

    // ============================================
    // SALVAR DESPESA
    // ============================================
    async salvarDespesa() {
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        
        try {
            // Desabilitar botão e mostrar loading
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            submitBtn.disabled = true;

            // Coletar dados básicos
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

            console.log('💾 Dados coletados:', despesaData);

            // Validar formulário
            if (!this.validarFormulario(despesaData)) {
                return;
            }

            // Upload do comprovante (se houver)
            const comprovanteFile = document.getElementById('comprovante').files[0];
            let comprovanteUploadado = false;

            if (comprovanteFile) {
                try {
                    console.log('📤 Iniciando upload do comprovante...');
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando comprovante...';
                    
                    const comprovanteUrl = await this.uploadComprovante(comprovanteFile);
                    despesaData.comprovanteUrl = comprovanteUrl;
                    despesaData.comprovanteNome = comprovanteFile.name;
                    despesaData.comprovanteSize = comprovanteFile.size;
                    despesaData.comprovanteType = comprovanteFile.type;
                    comprovanteUploadado = true;
                    
                    console.log('✅ Comprovante salvo:', comprovanteUrl);
                } catch (uploadError) {
                    console.error('❌ Erro no upload do comprovante:', uploadError);
                    this.mostrarNotificacao(
                        '⚠️ Aviso: Comprovante não foi salvo. ' + uploadError.message,
                        'error'
                    );
                    // Continua sem o comprovante
                }
            }

            // Salvar no Firestore
            console.log('💾 Salvando no Firestore...');
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizando...';
            
            const docRef = await firebase.firestore().collection('despesas').add(despesaData);
            
            console.log('✅ Despesa salva com ID:', docRef.id);
            
            // Mensagem de sucesso
            if (comprovanteUploadado) {
                this.mostrarNotificacao(
                    '✅ Despesa registrada com sucesso! Comprovante anexado.',
                    'success'
                );
            } else {
                this.mostrarNotificacao(
                    '✅ Despesa registrada com sucesso!',
                    'success'
                );
            }
            
            // Limpar formulário
            this.limparFormulario();

        } catch (error) {
            console.error('❌ Erro ao salvar despesa:', error);
            
            let mensagemErro = 'Erro ao salvar despesa';
            if (error.code === 'permission-denied') {
                mensagemErro = 'Sem permissão para salvar despesa';
            } else if (error.message) {
                mensagemErro = error.message;
            }
            
            this.mostrarNotificacao('❌ ' + mensagemErro, 'error');
        } finally {
            // Restaurar botão
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // ============================================
    // LIMPAR FORMULÁRIO
    // ============================================
    limparFormulario() {
        const form = document.getElementById('formDespesa');
        form.reset();
        
        document.getElementById('comprovantePreview').innerHTML = '';
        this.setDataAtual();
        
        // Scroll para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        console.log('🧹 Formulário limpo');
    }

    // ============================================
    // NOTIFICAÇÕES
    // ============================================
    mostrarNotificacao(mensagem, tipo) {
        // Remover notificação anterior
        const notifAnterior = document.querySelector('.notification');
        if (notifAnterior) {
            notifAnterior.remove();
        }

        // Criar nova notificação
        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.innerHTML = `
            <span>${mensagem}</span>
            <button onclick="this.parentElement.remove()" aria-label="Fechar">
                &times;
            </button>
        `;

        document.body.appendChild(notification);

        // Auto-remover após 5 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
}

// ============================================
// INICIALIZAR APP QUANDO DOM ESTIVER PRONTO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    window.despesasApp = new DespesasApp();
    console.log('✅ App de Despesas inicializado globalmente');
});
