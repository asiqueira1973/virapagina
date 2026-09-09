# Virapágina

Plataforma de flipbooks: qualquer pessoa cria conta, sobe PDFs e recebe um link
onde as pessoas folheiam o livro no navegador — sem instalar nada e sem criar
conta para ler.

- **Home:** `virapagina.app.br`
- **Vitrine de um autor:** `virapagina.app.br/<endereço>`
- **Leitor:** `virapagina.app.br/<endereço>/<livro>`
- **Painel do autor:** `/conta/livros`
- **Painel da plataforma:** `/admin` (só para os e-mails em `ADMIN_ALLOWED_EMAILS`)

Grátis até 5 livros. **Não há cobrança nesta versão** — o desenho está pronto em
`EPICO-COBRANCA.md`, para o dia em que alguém pedir mais espaço.

**Documentos:** `spec.md` é a fonte de verdade do produto. `CLAUDE.md` traz as
convenções e as armadilhas. `DOCUMENTACAO-TECNICA.md` descreve o que está
implementado, com as divergências.

---

## Rodar localmente

Não precisa de credencial nenhuma do Google: o desenvolvimento roda contra o
**emulador do Firebase**.

```bash
npm install
cp .env.example .env.local
```

Em um terminal, o emulador:

```bash
npm run emu
```

Em outro, o servidor e uma conta de exemplo com um livro publicado:

```bash
npm run dev
node scripts/seed-emulador.mjs caminho/do/arquivo.pdf
```

Abre em `http://localhost:3000`; o livro semeado fica em `/alexandre`.
O emulador exige **Java** instalado (`java -version`).

```bash
npm test        # 80 testes, sem dependência externa
npm run test:emu # 19 testes de integração — exige o emulador no ar
npm run lint
npm run typecheck
npm run build
```

O login com Google não funciona contra o emulador sem um OAuth Client ID real;
para exercitar o painel, preencha `GOOGLE_OAUTH_CLIENT_ID` e
`GOOGLE_OAUTH_CLIENT_SECRET` no `.env.local` com as credenciais de teste do passo
3 abaixo.

---

## Configurar o Firebase (fazer uma vez)

Sem estes passos o site sobe, mas toda tela mostra "Algo deu errado. Tente
novamente em instantes." — é o sintoma de não conseguir falar com o Google.

### 1. Projeto, Firestore e Storage

1. No [console do Firebase](https://console.firebase.google.com), crie um projeto
   **novo e dedicado** ao Virapágina.
2. Ative o **Cloud Firestore** (modo de produção — as regras deste repositório
   negam todo acesso do cliente de qualquer jeito).
3. Ative o **Storage**. Ele exige o plano **Blaze** desde fevereiro de 2026; a
   franquia permanente (5 GB armazenados e 100 GB de saída por mês) mantém a
   fatura em zero no volume inicial.
4. **Configure um alerta de orçamento** em Google Cloud → Faturamento → Orçamentos
   e alertas. O Blaze **não tem teto de gasto**, e sem receita não há nada para
   absorver uma surpresa. Este passo não é opcional.

### 2. Conta de serviço

1. Configurações do projeto → **Contas de serviço** → **Gerar nova chave privada**.
   O arquivo JSON baixa uma vez só; guarde-o em lugar seguro.
2. Do JSON, use `project_id`, `client_email` e `private_key` nas variáveis
   correspondentes (mantenha as quebras de linha como `\n`, entre aspas).

### 3. Login com Google

1. No [Google Cloud Console](https://console.cloud.google.com), no **mesmo
   projeto**: APIs e serviços → Tela de consentimento OAuth, tipo **Externo**.
2. Credenciais → **Criar credenciais** → **ID do cliente OAuth**, tipo
   **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, adicione as duas:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://virapagina.app.br/api/auth/callback/google`

### 4. CORS do bucket — o passo que mais é esquecido

O navegador envia os bytes do PDF direto para o Storage. Sem CORS no bucket, todo
upload falha no navegador e o servidor não tem como saber que falhou.

```bash
gcloud storage buckets update gs://<seu-bucket> --cors-file=cors.json
```

O `cors.json` está na raiz do repositório, já com as origens de produção e de
desenvolvimento.

### 5. Regras e índices

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project <seu-projeto>
```

As regras negam todo acesso do cliente ao Firestore e ao Storage. Isso é
intencional: a aplicação fala com os dois pelo Admin SDK, no servidor.

### 6. Quem entra no painel da plataforma

`ADMIN_ALLOWED_EMAILS` é a lista, separada por vírgula, dos e-mails Google com
acesso a `/admin`. **As contas desses e-mails também nascem com plano
ilimitado**, sem limite de livros e sem franquia de tráfego — e se corrigem
sozinhas a cada login, mesmo que alguém as altere no console.

Quem não está na lista recebe **404** em `/admin`, não uma tela de acesso negado.

---

## Variáveis de ambiente

| Variável | Segreda? | Para quê |
|---|---|---|
| `FIREBASE_PROJECT_ID` | não | Projeto do Firebase |
| `FIREBASE_CLIENT_EMAIL` | não | Conta de serviço do Admin SDK |
| `FIREBASE_PRIVATE_KEY` | **sim** | Chave da conta de serviço. **A credencial mais sensível do projeto** — dá acesso total aos dados e aos arquivos |
| `FIREBASE_STORAGE_BUCKET` | não | Bucket dos arquivos |
| `GOOGLE_OAUTH_CLIENT_ID` | não | Login |
| `GOOGLE_OAUTH_CLIENT_SECRET` | **sim** | Login |
| `NEXTAUTH_SECRET` | **sim** | Assina o cookie de sessão. Gere com `openssl rand -base64 32` |
| `NEXTAUTH_URL` | não | URL do deploy |
| `ADMIN_ALLOWED_EMAILS` | **sim** | Admins da plataforma; estas contas também nascem ilimitadas |
| `CRON_SECRET` | **sim** | Protege a rotina diária de aviso de tráfego |
| `EMAIL_CONTATO` | não | Aparece nos termos, na privacidade, no canal de denúncia e no botão "Falar com a gente" |

Em desenvolvimento, no lugar das credenciais: `FIRESTORE_EMULATOR_HOST`,
`FIREBASE_STORAGE_EMULATOR_HOST` e `STORAGE_EMULATOR_HOST`, como no
`.env.example`.

---

## Deploy na Vercel

1. Conecte o repositório; `main` é produção.
2. Configure as variáveis acima em **Settings → Environment Variables**.
   `NEXTAUTH_URL` recebe `https://virapagina.app.br`.
3. Aponte o domínio em **Settings → Domains**.
4. Confirme que a URI de redirecionamento de produção está cadastrada no OAuth
   Client (passo 3 acima) — é o que falha primeiro quando o login funciona local
   e quebra em produção.
5. Agende a rotina diária em **Settings → Cron Jobs**:
   `POST /api/rotinas/avisar-trafego`, com o cabeçalho
   `Authorization: Bearer <CRON_SECRET>`.

---

## Publicar um livro

1. Entre em `/entrar` com o Google. Na primeira vez, escolha seu endereço público
   — ele **não pode ser trocado depois**.
2. Em `/conta/livros`, clique **Novo livro**.
3. Preencha o título; o link é sugerido automaticamente e pode ser editado.
4. Escolha o PDF (até 100 MB). O total de páginas e a capa saem da primeira
   página, sozinhos.
5. O livro é salvo como **rascunho**. Use **Ver como ficaria** para conferir a
   leitura antes de qualquer pessoa ver.
6. Clique **Publicar**. O livro entra na sua vitrine e o link passa a responder
   para todo mundo.
