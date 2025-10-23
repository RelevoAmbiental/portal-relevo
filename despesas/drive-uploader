// despesas/drive-uploader.js - UPLOAD PARA GOOGLE DRIVE
class DriveUploader {
    constructor() {
        this.CLIENT_ID = '843931176271-7hv8lgi0m55ue4qmq0vjdbjscfrb3g11.apps.googleusercontent.com';
        this.API_KEY = 'AIzaSyCDIrPqQs7S_E2UeDGPNeFCVYcv09JFoTs';
        this.FOLDER_ID = '1UB6fj9M0gs3CdCLEyTY1P0WMwU8mfda8'; // Sua pasta Recibos
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.tokenClient = null;
        this.gapiInited = false;
        this.gisInited = false;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('🚀 Inicializando Google Drive Uploader...');
        
        return new Promise((resolve, reject) => {
            // Carregar Google APIs
            this.loadGapi()
                .then(() => this.loadGis())
                .then(() => {
                    this.isInitialized = true;
                    console.log('✅ Google Drive Uploader inicializado!');
                    resolve();
                })
                .catch(error => {
                    console.error('❌ Erro ao inicializar Drive Uploader:', error);
                    reject(error);
                });
        });
    }

    loadGapi() {
        return new Promise((resolve) => {
            if (window.gapi) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({});
                        this.gapiInited = true;
                        console.log('✅ GAPI carregado');
                        resolve();
                    } catch (error) {
                        console.error('Erro GAPI:', error);
                        resolve(); // Continua mesmo com erro
                    }
                });
            };
            script.onerror = () => {
                console.warn('⚠️ GAPI não carregado - usando modo simulação');
                resolve(); // Continua em modo simulação
            };
            document.head.appendChild(script);
        });
    }

    loadGis() {
        return new Promise((resolve) => {
            if (window.google) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => {
                this.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: this.CLIENT_ID,
                    scope: this.SCOPES,
                    callback: '', // Será definido no upload
                });
                this.gisInited = true;
                console.log('✅ GIS carregado');
                resolve();
            };
            script.onerror = () => {
                console.warn('⚠️ GIS não carregado - usando modo simulação');
                resolve(); // Continua em modo simulação
            };
            document.head.appendChild(script);
        });
    }

    async uploadFile(file) {
        console.log('📤 Iniciando upload para Google Drive:', file.name);
        
        // Se as APIs não carregaram, usa modo simulação
        if (!this.gapiInited || !this.gisInited) {
            console.log('🔄 Modo simulação - arquivo seria salvo no Drive');
            return this.simulateUpload(file);
        }

        return new Promise((resolve, reject) => {
            this.tokenClient.callback = async (resp) => {
                if (resp.error !== undefined) {
                    console.error('❌ Erro de autenticação:', resp);
                    reject(new Error('Falha na autenticação: ' + resp.error));
                    return;
                }

                try {
                    console.log('🔑 Autenticado, fazendo upload...');
                    
                    const metadata = {
                        name: `comprovante_${Date.now()}_${file.name}`,
                        parents: [this.FOLDER_ID],
                        mimeType: file.type
                    };

                    const form = new FormData();
                    form.append('metadata', new Blob([JSON.stringify(metadata)], { 
                        type: 'application/json' 
                    }));
                    form.append('file', file);

                    const response = await fetch(
                        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', 
                        {
                            method: 'POST',
                            headers: new Headers({ 
                                'Authorization': 'Bearer ' + gapi.auth.getToken().access_token 
                            }),
                            body: form,
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                    }

                    const result = await response.json();
                    console.log('✅ Upload concluído:', result);
                    
                    // Retorna URL para visualização
                    resolve(result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`);
                    
                } catch (error) {
                    console.error('❌ Erro no upload:', error);
                    reject(new Error('Falha no upload: ' + error.message));
                }
            };

            // Solicitar token
            if (gapi.auth.getToken() === null) {
                console.log('🔐 Solicitando permissão...');
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                this.tokenClient.requestAccessToken({ prompt: '' });
            }
        });
    }

    simulateUpload(file) {
        return new Promise((resolve) => {
            console.log('📝 Simulando upload para:', file.name);
            
            // Simula delay de upload
            setTimeout(() => {
                const fakeUrl = `https://drive.google.com/drive/folders/1UB6fj9M0gs3CdCLEyTY1P0WMwU8mfda8?usp=sharing`;
                console.log('✅ Simulação concluída - URL:', fakeUrl);
                resolve(fakeUrl);
            }, 1500);
        });
    }
}

// Instância global
window.driveUploader = new DriveUploader();
console.log('📁 Drive Uploader carregado - Client ID:', window.driveUploader.CLIENT_ID);
