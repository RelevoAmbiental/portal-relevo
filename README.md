# 🌿 Portal Relevo - Sistema Interno

Sistema de autenticação e portal interno para a **Relevo Consultoria Ambiental**, proporcionando acesso seguro e organizado para colaboradores, gestão e clientes.

## 🚀 Sobre o Projeto

Sistema web desenvolvido para gerenciar o acesso diferenciado aos recursos internos da Relevo Consultoria Ambiental, com:

- **🔐 Autenticação segura** via Firebase
- **👥 Múltiplos níveis de acesso** (Gestão, Colaboradores, Clientes)
- **📁 Integração com Google Drive** para documentação
- **📱 Design totalmente responsivo**
- **🎯 Experiência personalizada** por tipo de usuário

## 🏗️ Estrutura do Sistema

### Páginas Principais
- **`index.html`** - Página de login e autenticação
- **`gestao.html`** - Portal administrativo e dashboard
- **`colaboradores.html`** - Recursos para equipe interna
- **`clientes.html`** - Acesso para clientes e parceiros

### Tecnologias Utilizadas
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Autenticação**: Firebase Authentication
- **Banco de Dados**: Firestore (NoSQL)
- **Hospedagem**: GitHub Pages
- **Ícones**: Repositório próprio GitHub
- **Fontes**: Google Fonts (Montserrat)

## 👤 Níveis de Acesso

### 1. **Gestão** (`tipo: "gestao"`)
- Dashboard completo com métricas
- Acesso a todos os recursos administrativos
- Controle financeiro e relatórios
- Gestão de equipe e projetos

### 2. **Colaboradores** (`tipo: "colaboradores"`)
- Pasta de dados da empresa
- Fichas de SST (Saúde e Segurança)
- Formulário de despesas de campo
- Modelos de relatórios

### 3. **Clientes** (`tipo: "clientes"`)
- Dados cadastrais da Relevo
- Acesso à pasta específica do projeto
- Documentação técnica e relatórios

## 🔧 Configuração e Deploy

### Pré-requisitos
- Conta no [Firebase](https://firebase.google.com)
- Conta no [GitHub](https://github.com)
- Projeto no Google Cloud Platform

### Configuração do Firebase
1. Criar projeto no Firebase Console
2. Ativar Authentication (Email/Senha)
3. Configurar Firestore Database
4. Adicionar domínios autorizados

### Deploy no GitHub Pages
1. Fazer upload dos arquivos para o repositório
2. Ativar GitHub Pages nas configurações
3. Acessar via: `https://seuusuario.github.io/portal-relevo`

## 📁 Estrutura de Arquivos

portal-relevo/
├── index.html # Página de login
├── gestao.html # Portal de gestão
├── colaboradores.html # Portal colaboradores
├── clientes.html # Portal clientes
├── README.md # Este arquivo
└── assets/ # (Opcional) Imagens e ícones


## 🔐 Segurança

- Autenticação serverless via Firebase
- Dados sensíveis protegidos no Firestore
- Redirecionamento automático para não autenticados
- Logout seguro com limpeza de sessão

## 📞 Suporte e Manutenção

### Para adicionar novos usuários:
1. Firebase Console → Authentication → Adicionar usuário
2. Firestore → Coleção `users` → Novo documento com UID
3. Preencher campos: `username`, `nome`, `tipo`, `projeto`

### Para novos projetos de clientes:
1. Adicionar entrada no objeto `projetos` em `clientes.html`
2. Criar pasta correspondente no Google Drive
3. Cadastrar usuários com campo `projeto` específico

## 🐛 Solução de Problemas Comuns

### Erro "Invalid Login Credentials"
- Verificar se usuário existe no Firebase Authentication
- Confirmar senha correta
- Checar se documento existe no Firestore com UID correto

### Página não carrega no GitHub Pages
- Verificar se todos os arquivos foram commitados
- Confirmar se GitHub Pages está ativado
- Checar console do navegador para erros

## 👥 Contribuição

Este é um projeto interno da Relevo Consultoria Ambiental. Para sugestões ou melhorias, entre em contato com a equipe de desenvolvimento.

## 📄 Licença

Proprietário - Relevo Consultoria Ambiental © 2025. Todos os direitos reservados.

---

**Desenvolvido com 💚 para a Relevo Consultoria Ambiental**