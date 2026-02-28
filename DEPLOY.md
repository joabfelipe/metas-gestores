# Guia de Deploy - Metas Gestores

Este guia passo a passo ajudará você a implantar sua aplicação usando **GitHub** e **Render.com**.

## 1. Preparação do Ambiente

O sistema já está configurado para deploy, com as dependências corretas e scripts de inicialização.

### Verifique se o Git está instalado
O comando `git` não foi reconhecido no terminal. Se você ainda não tem o Git instalado:
1. Baixe e instale o Git: [https://git-scm.com/downloads](https://git-scm.com/downloads)
2. Após instalar, feche e abra novamente o seu editor de código ou terminal.

## 2. Configuração do Banco de Dados (MongoDB Atlas)

O Render não oferece banco de dados MongoDB gratuito nativamente, então usaremos o **MongoDB Atlas** (que tem um plano gratuito excelente).

1. Crie uma conta no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Crie um novo Cluster (o plano "M0 Sandbox" é gratuito).
3. Em **Database Access**, crie um usuário e senha para o banco.
4. Em **Network Access**, adicione o IP `0.0.0.0/0` (para permitir acesso de qualquer lugar, necessário para o Render).
5. Clique em **Connect** > **Drivers** e copie a "Connection String".
   - Ela se parece com: `mongodb+srv://<usuario>:<senha>@cluster0.mongodb.net/?retryWrites=true&w=majority`
   - Substitua `<usuario>` e `<senha>` pelos dados que você criou.

## 3. Enviando o Código para o GitHub

1. Abra o terminal na pasta do projeto.
2. Inicialize o repositório e faça o primeiro commit:
   ```bash
   git init
   git add .
   git commit -m "Primeiro commit - Preparando para deploy"
   ```
3. Crie um novo repositório no [GitHub](https://github.com/new).
4. Siga as instruções do GitHub para enviar o código (exemplo):
   ```bash
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
   git push -u origin main
   ```

## 4. Deploy no Render.com

1. Crie uma conta no [Render.com](https://render.com/).
2. Clique em **New +** e selecione **Web Service**.
3. Conecte sua conta do GitHub e selecione o repositório que você acabou de criar.
4. Preencha os campos:
   - **Name**: Nome do seu serviço (ex: metas-gestores).
   - **Region**: Escolha a mais próxima (ex: Ohio ou Frankfurt).
   - **Branch**: `main`.
   - **Root Directory**: Deixe em branco.
   - **Runtime**: `Node`.
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free.

5. **Variáveis de Ambiente (Environment Variables)**:
   Role para baixo até a seção "Environment Variables" e adicione:
   
   | Key | Value |
   | --- | --- |
   | `MONGO_URI` | A string de conexão do MongoDB Atlas (passo 2) |
   | `SESSION_SECRET` | Uma senha longa e aleatória para proteger as sessões |
   | `NODE_ENV` | `production` |

6. Clique em **Create Web Service**.

O Render começará a construir seu projeto. Você pode acompanhar o progresso na aba "Logs". Quando terminar, ele mostrará a URL do seu site (ex: `https://metas-gestores.onrender.com`).
