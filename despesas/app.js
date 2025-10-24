// despesas/app.js - VERSÃO OTIMIZADA
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

        this.init();
    }

    init() {
        this.carregarSelects();
        document.getElementById('data').valueAsDate = new Date();
        this.setupEventListeners();
        console.log('🚀 App de Despesas inicializado');
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
            // Validar tamanho
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                reject(new Error('Arquivo muito grande. Máximo 10MB.'));
                return;
            }

            // Nome único
            const timestamp = Date.now();
            const nomeArquivo = `comprovantes/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            
            // Upload
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(nomeArquivo);
            
            const uploadTask = fileRef.put(file);

            uploadTask.on('state_changed',
                null,
                (error) => {
                    console.error('❌ Erro upload:', error);
                    reject(new Error('Falha no upload: ' + error.message));
                },
                async () => {
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve(downloadURL);
                    } catch (urlError) {
                        reject(new Error('Falha ao obter URL'));
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

            // Coletar dados
            const despesaData = {
                projeto: document.getElementById('projeto').value,
                funcionario: document.getElementById('funcionario').value,
                data: document.getElementById('data').value,
                tipo: document.getElementById('tipo').value,
                descricao: document.getElementById('descricao').value,
                valor: this.parseValor(document.getElementById('valor').value),
                status: 'pendente',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Validar
            if (!this.validarFormulario(despesaData)) {
                return;
            }

            // Upload comprovante
            const comprovanteFile = document.getElementById('comprovante').files[0];
            if (comprovanteFile) {
                try {
                    const comprovanteUrl = await this.uploadComprovante(comprovanteFile);
                    despesaData.comprovanteUrl = comprovanteUrl;
                    despesaData.comprovanteNome = comprovanteFile.name;
                } catch (uploadError) {
                    this.mostrarNotificacao('Erro no upload do comprovante. Salvando sem comprovante...', 'error');
                }
            }

            // Salvar no Firestore
            await db.collection('despesas').add(despesaData);
            
            this.mostrarNotificacao('Despesa registrada com sucesso! ✅', 'success');
            this.limparFormulario();

        } catch (error) {
            console.error('❌ Erro ao salvar:', error);
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
            
            return parseFloat(valorLimpo) || 0;
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

// Inicializar app
document.addEventListener('DOMContentLoaded', () => {
    window.despesasApp = new DespesasApp();
});
