// despesas/app.js - VERSÃO COMPATÍVEL COM FIREBASE v9
class DespesasApp {
    constructor() {
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

        // Verificar se Firebase está carregado
        this.verificarFirebase();
        this.init();
    }

    verificarFirebase() {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase não carregado!');
            return false;
        }
        console.log('✅ Firebase carregado:', typeof firebase);
        return true;
    }

    init() {
        if (!this.verificarFirebase()) {
            this.mostrarNotificacao('Erro: Firebase não carregado. Recarregue a página.', 'error');
            return;
        }

        this.carregarSelects();
        document.getElementById('data').valueAsDate = new Date();
        this.setupEventListeners();
        console.log('🚀 App de Despesas inicializado com Firebase v9');
    }

    setupEventListeners() {
        document.getElementById('formDespesa').addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarDespesa();
        });

        document.getElementById('comprovante').addEventListener('change', (e) => {
            this.previewComprovante(e.target.files[0]);
        });

        document.getElementById('valor').addEventListener('blur', (e) => {
            this.formatarValor(e.target);
        });
    }

    carregarSelects() {
        this.carregarOptions('projeto', this.CONFIG.projetos);
        this.carregarOptions('funcionario', this.CONFIG.funcionarios);
        this.carregarOptions('tipo', this.CONFIG.tiposDespesa);
    }

    carregarOptions(selectId, options) {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Selecione...</option>';
        options.forEach(option => {
            select.innerHTML += `<option value="${option}">${option}</option>`;
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
        
        if (!file) {
            preview.innerHTML = '';
            return;
        }

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <div class="preview-image">
                        <img src="${e.target.result}" alt="Preview do comprovante">
                        <small>${file.name} (${this.formatFileSize(file.size)})</small>
                    </div>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = `
                <div class="preview-file">
                    <i class="fas fa-file"></i>
                    <small>${file.name} (${this.formatFileSize(file.size)})</small>
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

    async uploadComprovante(file) {
        return new Promise((resolve, reject) => {
            // Verificar se storage está disponível
            if (typeof firebase === 'undefined' || !firebase.storage) {
                reject(new Error('Firebase Storage não disponível'));
                return;
            }

            // Validar tamanho
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                reject(new Error('Arquivo muito grande. Máximo 10MB.'));
                return;
            }

            // Nome único
            const timestamp = Date.now();
            const nomeArquivo = `comprovantes/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            
            console.log('📤 Iniciando upload:', nomeArquivo);

            // Upload usando Firebase v9 compat
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(nomeArquivo);
            
            const uploadTask = fileRef.put(file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progresso
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`📊 Upload ${progress.toFixed(1)}% completo`);
                },
                (error) => {
                    console.error('❌ Erro upload:', error);
                    reject(new Error('Falha no upload: ' + error.message));
                },
                async () => {
                    try {
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

    async salvarDespesa() {
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            submitBtn.disabled = true;

            // Verificar se Firebase está disponível
            if (typeof firebase === 'undefined' || !firebase.firestore) {
                throw new Error('Firebase não carregado corretamente');
            }

            // Coletar dados
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

            console.log('💾 Dados coletados:', despesaData);

            // Validar
            if (!this.validarFormulario(despesaData)) {
                return;
            }

            // Upload comprovante
            const comprovanteFile = document.getElementById('comprovante').files[0];
            if (comprovanteFile) {
                try {
                    console.log('📤 Iniciando upload do comprovante...');
                    const comprovanteUrl = await this.uploadComprovante(comprovanteFile);
                    despesaData.comprovanteUrl = comprovanteUrl;
                    despesaData.comprovanteNome = comprovanteFile.name;
                    console.log('✅ Comprovante salvo:', comprovanteUrl);
                } catch (uploadError) {
                    console.warn('⚠️ Erro no upload do comprovante:', uploadError);
                    this.mostrarNotificacao('Aviso: Comprovante não foi salvo, mas a despesa será registrada.', 'error');
                }
            }

            // Salvar no Firestore
            console.log('💾 Salvando no Firestore...');
            const docRef = await firebase.firestore().collection('despesas').add(despesaData);
            
            console.log('✅ Despesa salva com ID:', docRef.id);
            this.mostrarNotificacao('Despesa registrada com sucesso! ✅', 'success');
            this.limparFormulario();

        } catch (error) {
            console.error('❌ Erro ao salvar despesa:', error);
            this.mostrarNotificacao('Erro ao salvar despesa: ' + error.message, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    validarFormulario(data) {
        const camposObrigatorios = ['projeto', 'funcionario', 'data', 'tipo'];
        
        for (let campo of camposObrigatorios) {
            if (!data[campo]) {
                this.mostrarNotificacao(`Preencha o campo: ${campo}`, 'error');
                document.getElementById(campo)?.focus();
                return false;
            }
        }

        if (!data.valor || data.valor <= 0) {
            this.mostrarNotificacao('Informe um valor válido', 'error');
            document.getElementById('valor').focus();
            return false;
        }

        return true;
    }

    parseValor(valorString) {
        if (!valorString) return 0;
        
        try {
            let valorLimpo = valorString.replace('R$', '').replace(/\s/g, '').trim();
            
            if (valorLimpo.includes(',') && valorLimpo.includes('.')) {
                valorLimpo = valorLimpo.replace(/\./g, '').replace(',', '.');
            } else if (valorLimpo.includes(',')) {
                valorLimpo = valorLimpo.replace(',', '.');
            }
            
            const valorNumerico = parseFloat(valorLimpo);
            return isNaN(valorNumerico) ? 0 : valorNumerico;
        } catch (error) {
            return 0;
        }
    }

    mostrarNotificacao(mensagem, tipo) {
        // Remover notificação anterior
        const notifAnterior = document.querySelector('.notification');
        if (notifAnterior) notifAnterior.remove();

        // Criar nova
        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.innerHTML = `
            <span>${mensagem}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;

        document.body.appendChild(notification);

        // Auto-remover
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
}

// Inicializar app quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que Firebase carregou
    setTimeout(() => {
        window.despesasApp = new DespesasApp();
    }, 100);
});
