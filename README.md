# Virapágina

> **Atenção — este documento descreve a v2.0, que é o código que está no repositório.**
> O `spec.md` já está na **v3.0** (produto multi-tenant com Firestore e Firebase
> Storage), que **ainda não foi implementada**. Enquanto a v3.0 não for construída,
> o que vale aqui como descrição do sistema é a v2.0: Google Sheets, Google Drive e
> um único administrador por allowlist. O desenho da cobrança está em
> `EPICO-COBRANCA.md` e também não foi implementado.

Plataforma própria de flipbooks: PDFs que qualquer pessoa folheia no navegador,
com uma URL por publicação e um painel para subir títulos novos. Substitui o
Heyzine nas publicações do Alexandre.

- **Leitor público:** `virapagina.app.br/l/<slug>` — vira página com clique,
  arrasto, swipe e teclado; zoom, tela cheia, baixar, imprimir e compartilhar.
- **Catálogo:** `virapagina.app.br` — os livros publicados.
- **Painel:** `virapagina.app.br/admin` — login com Google, restrito por lista de
  e-mails.

Sem banco de dados: os metadados ficam numa planilha do Google Sheets e os
arquivos numa pasta do Google Drive, ambos na conta do Alexandre.

**Documentos do projeto:** `spec.md` é a fonte de verdade do produto.
`CLAUDE.md` traz as convenções e as armadilhas do repositório.
`DOCUMENTACAO-TECNICA.md` descreve o que está implementado, com as divergências.

---

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha conforme a seção abaixo
npm run dev
```

Abre em `http://localhost:3000`.

```bash
npm test        # 44 testes
npm run lint
npm run typecheck
npm run build
```

---

## Configuração do Google Cloud (fazer uma vez)

Sem estes passos o site sobe, mas toda tela mostra
"Algo deu errado. Tente novamente em instantes." — é o sintoma de a aplicação não
conseguir falar com o Sheets ou o Drive.

### 1. Projeto e APIs

1. No [Google Cloud Console](https://console.cloud.google.com), crie um projeto
   (ou reaproveite um existente).
2. Em **APIs e serviços → Biblioteca**, ative as duas:
   - **Google Sheets API**
   - **Google Drive API**

### 2. Conta de serviço (é ela que lê e escreve os dados)

1. **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**.
2. Dê um nome (ex. `virapagina`) e crie. Anote o e-mail gerado, algo como
   `virapagina@<projeto>.iam.gserviceaccount.com`.
3. Na conta de serviço criada, aba **Chaves → Adicionar chave → Criar nova chave
   → JSON**. O arquivo baixa uma vez só; guarde-o em lugar seguro.
4. Do JSON, use `client_email` em `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `private_key`
   em `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (mantenha as quebras de linha como
   `\n`, entre aspas).

### 3. OAuth para o login do admin (separado da conta de serviço)

1. **APIs e serviços → Tela de consentimento OAuth**: tipo **Externo**, preencha o
   básico e adicione o seu e-mail como usuário de teste (ou publique o app).
2. **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo
   **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, adicione as duas:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://virapagina.app.br/api/auth/callback/google`
4. Use o ID e o segredo em `GOOGLE_OAUTH_CLIENT_ID` e
   `GOOGLE_OAUTH_CLIENT_SECRET`.

### 4. A planilha e a pasta

Já existem no Drive do Alexandre, dentro da pasta **Virapágina**:

| O quê | Onde | Variável |
|---|---|---|
| Planilha `livros` | [abrir](https://docs.google.com/spreadsheets/d/1Q8jikDTBJyYv9AjoSzhlYEd5Yvmz2Ycm5d-fXtCv_kk/edit) | `GOOGLE_SHEET_ID=1Q8jikDTBJyYv9AjoSzhlYEd5Yvmz2Ycm5d-fXtCv_kk` |
| Pasta `Arquivos` | [abrir](https://drive.google.com/drive/folders/1c0TbP8RDUZsWYECLIiy0O5Xjq1DVMK-C) | `GOOGLE_DRIVE_FOLDER_ID=1c0TbP8RDUZsWYECLIiy0O5Xjq1DVMK-C` |

**Dois passos obrigatórios:**

1. **Confirme que a aba da planilha se chama `livros`** (minúsculo). O código
   procura por esse nome exato. O cabeçalho da linha 1 já está gravado, nesta
   ordem:

   ```
   id · titulo · subtitulo · slug · autor · descricao · arquivo_pdf_drive_id ·
   arquivo_pdf_tamanho_bytes · capa_drive_id · total_paginas · publicado ·
   criado_por · criado_em · atualizado_em
   ```

2. **Compartilhe a planilha e a pasta com o e-mail da conta de serviço**, com
   permissão de **Editor**. Sem isso a aplicação não lê nem escreve nada. É o erro
   mais comum na primeira configuração.

### 5. Quem entra no painel

`ADMIN_ALLOWED_EMAILS` é a lista, separada por vírgula, dos e-mails Google que
podem acessar `/admin`. Não existe tela de cadastro nem convite: adicionar um
admin é editar essa variável. Quem não está na lista consegue logar no Google,
mas recebe "Esse e-mail não tem acesso ao painel." e nenhuma sessão é criada.

---

## Variáveis de ambiente

| Variável | O que é |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | E-mail da conta de serviço |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Chave privada do JSON. **O segredo mais sensível do projeto** — dá escrita na planilha e na pasta inteira. Nunca commitar. |
| `GOOGLE_SHEET_ID` | Id da planilha com a aba `livros` |
| `GOOGLE_DRIVE_FOLDER_ID` | Id da pasta onde ficam os PDFs e as capas |
| `GOOGLE_OAUTH_CLIENT_ID` | Login do admin |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Login do admin |
| `NEXTAUTH_SECRET` | Assina o cookie de sessão. Gere com `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL do deploy (`http://localhost:3000` no desenvolvimento) |
| `ADMIN_ALLOWED_EMAILS` | Lista de e-mails com acesso ao painel |

---

## Deploy na Vercel

1. Conecte o repositório; `main` é produção.
2. Configure as nove variáveis acima em **Settings → Environment Variables**.
   `NEXTAUTH_URL` recebe `https://virapagina.app.br`.
3. Aponte o domínio `virapagina.app.br` para a Vercel em **Settings → Domains**.
4. Confirme que a URI de redirecionamento de produção está cadastrada no OAuth
   Client (passo 3 acima) — é o que falha primeiro quando o login funciona local e
   quebra em produção.

---

## Publicar um livro

1. Entre em `/admin/livros` e clique **Novo livro**.
2. Preencha o título; o link é sugerido automaticamente e pode ser editado.
3. Escolha o PDF (até 100 MB). O total de páginas e a capa saem da primeira
   página, sozinhos.
4. O livro é salvo como **rascunho**. Use **Ver como ficaria** para conferir a
   leitura antes de qualquer pessoa ver.
5. Clique **Publicar**. O livro entra no catálogo e a URL passa a responder para
   todo mundo.
