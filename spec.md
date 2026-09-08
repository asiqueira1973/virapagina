---
Documento: spec.md — Virapágina
Versão: 2.0 (v1.0 usava Supabase como backend; v2.0 substitui por Google Sheets + Google Drive, a pedido do Alexandre — mudança propagada por todo o documento)
Responsável de produto: Alexandre Siqueira
Status: rascunho
Data: 2026-09-08
---

# Virapágina — Especificação de Software (SDD)

## Como usar este documento

Este spec.md é a fonte única de verdade do produto **Virapágina**, uma plataforma própria de flipbooks (livros digitais com efeito de virar página), construída para substituir o Heyzine nas publicações de Alexandre (o livro *Conceitos de Tecnologia para Pessoas Executivas e Não Técnicas* e a revista trimestral *I See Life*, entre outras futuras).

Destina-se a ser colado, inteiro, num agente de código (Claude Code) para implementação direta. A seção 24 (Assunções declaradas) deve ser revisada por Alexandre **antes** de iniciar a implementação — assunção não revisada vira verdade no minuto em que o agente começa a codar. A seção 25 (Perguntas abertas) lista o que só Alexandre pode decidir.

**Nota de versão:** a v1.0 usava Supabase (Postgres + Auth + Storage) como backend. A pedido do Alexandre, a v2.0 substitui isso por **Google Sheets** (dados) e **Google Drive** (arquivos), sem banco relacional. A mudança foi propagada por todas as seções afetadas: arquitetura, autenticação, permissões, modelo de dados, API, segurança e riscos.

---

## 0. Princípios não-negociáveis

1. **PDF é a fonte da verdade.** O livro nunca é reprocessado em imagens estáticas no upload; a leitura renderiza o PDF original diretamente no navegador. Isso evita duplicar armazenamento e garante que o link de download sempre bate com o que a pessoa está lendo.
2. **Sem conta para ler.** Nenhuma barreira de login, cadastro ou paywall para o leitor público — o objetivo é distribuição fácil, igual a um link do Heyzine.
3. **Google Workspace como back-office, sem banco separado.** Os dados vivem numa planilha do Google Sheets e os arquivos num Drive do próprio Alexandre — nada de infraestrutura de banco adicional para operar ou pagar.
4. **Um admin, um dono.** O painel administrativo é de uso pessoal do Alexandre (ou de quem ele autorizar depois, por e-mail); não há autocadastro de administrador.
5. **Simplicidade antes de complexidade prematura.** Sem multi-tenant, sem planos pagos, sem analytics avançado no MVP — isso só entra se e quando fizer sentido (ver Roadmap).
6. **Mobile é cidadão de primeira classe.** A maior parte da audiência do Alexandre (LinkedIn, Substack) acessa pelo celular; qualquer decisão de UX que funcione bem no desktop mas mal no mobile perde.

---

## 1. Visão e problema

O Alexandre publica conteúdo em formato de "revista digital" (livros e zines em PDF) e hoje paga o Heyzine para ter a experiência de leitura em flipbook sem marca d'água. O Virapágina é uma plataforma própria, hospedada na Vercel, que entrega a mesma experiência (efeito de virar página, download, impressão, compartilhamento, zoom) para qualquer PDF que ele suba, com uma URL própria por publicação e um painel simples para adicionar novos títulos — sem depender de um banco de dados tradicional: os metadados ficam numa planilha do Google Sheets e os arquivos num Google Drive, ambos da própria conta do Alexandre.

**Anti-escopo (o que este produto não é):**
- Não é um editor de PDF ou de layout — o PDF chega pronto, produzido em outra ferramenta (Canva, o pipeline de geração do livro, etc.).
- Não é uma plataforma multiusuário/multi-tenant — não há contas de leitor, não há diferentes editores publicando (no MVP).
- Não é uma loja — não processa pagamento nem paywall.
- Não substitui o Substack como canal de distribuição por e-mail; é só o "player" do PDF.
- Não é um banco de dados de verdade — é uma planilha fazendo esse papel, por escolha deliberada de simplicidade (ver riscos, seção 23, sobre os limites dessa escolha).

---

## 2. Personas e cenários de uso

- **Alexandre (admin):** sobe um PDF novo depois de fechar uma edição do livro ou da zine, define título/slug, confere a prévia, publica, e cola o link no post do LinkedIn. Uso esporádico (a cada poucas semanas), no desktop.
- **Leitor público:** chega pelo link (LinkedIn, WhatsApp, e-mail), abre no celular na maior parte das vezes, folheia algumas páginas, eventualmente baixa o PDF ou compartilha o link com outra pessoa. Não tem paciência para esperar carregamento nem para descobrir como usar os controles — a interface precisa ser autoexplicativa (ícones conhecidos: seta, lupa, download, compartilhar).

---

## 3. Escopo do MVP

**Dentro do MVP:**
- Leitura pública de um livro em formato flipbook (efeito de virar página), responsiva (desktop e mobile).
- URL própria por livro (`/l/<slug>`).
- Ações do leitor: avançar/voltar página (clique, arrasto, teclado, swipe no mobile), zoom in/out, tela cheia, baixar o PDF original, imprimir, compartilhar o link.
- Painel admin (login com Google, restrito ao e-mail do Alexandre): listar livros, subir novo livro (PDF + metadados), editar metadados, publicar/despublicar, excluir.
- Página de catálogo público simples, listando os livros publicados (para quem chega direto na home sem link de um livro específico).
- Dados guardados numa planilha do Google Sheets; arquivos (PDF e capa) guardados numa pasta do Google Drive — ambos na conta Google do próprio Alexandre.

**Fora do MVP (ver Roadmap, seção 28):**
- Múltiplos administradores/convite de equipe — adiado até haver necessidade real de mais de uma pessoa publicando (hoje já dá pra adicionar um segundo e-mail na lista de permitidos, mas sem tela de gestão disso).
- Analytics de leitura (quantas pessoas abriram, até que página leram) — adiado; começar simples e medir depois se fizer falta.
- Multi-tenant / white-label para clientes da Dab Lab — ideia mencionada na conversa, mas não faz parte deste MVP; descartada por ora para não inflar o escopo antes de validar o uso pessoal.
- Formulários embutidos, vídeo/áudio embutido na página (recursos do Heyzine que Alexandre não pediu) — descartados, fora do uso real.
- Grade de miniaturas de página (ícone de "grid" do Heyzine) — adiado para v2, não é essencial pro MVP.
- Migração para um banco de verdade — se o volume de livros ou de acessos crescer a ponto da planilha ser um gargalo real (ver riscos, seção 23), migrar para Postgres/Supabase é o caminho natural, mas não faz parte deste MVP.

---

## 4. Arquitetura

**Stack:**

| Camada | Tecnologia | Por quê | Alternativa descartada |
|---|---|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, React | Deploy nativo na Vercel, SSR pra SEO do catálogo público | Vite SPA — perderia SSR/SEO das páginas de livro |
| Estilo | Tailwind CSS | Padrão rápido, fácil de manter sozinho | CSS module — mais atrito sem ganho real aqui |
| Leitura de PDF | `pdfjs-dist` (Mozilla PDF.js), renderizado em `<canvas>` no cliente | Não exige reprocessar o PDF em imagens no upload; o PDF enviado é a fonte única | Pré-gerar imagens PNG por página no upload — mais armazenamento, mais complexidade de pipeline, sem benefício real no volume de uso do Alexandre |
| Efeito de virar página | `react-pageflip` (wrapper do StPageFlip, MIT license) sobre os canvases do PDF.js | Biblioteca madura, gratuita, com modo retrato nativo pra mobile | Construir o efeito do zero — reinventar a roda sem necessidade |
| Dados (metadados dos livros) | **Google Sheets**, via Google Sheets API v4 | Decisão explícita do Alexandre: sem banco relacional, back-office fica dentro do próprio Google Drive dele | Postgres/Supabase (era a v1.0 desta spec) — descartado a pedido, para não ter infraestrutura de banco separada |
| Arquivos (PDF e capa) | **Google Drive**, pasta dedicada, via Google Drive API v3 | Mesmo motivo acima — arquivos ficam no Drive pessoal do Alexandre | Supabase Storage (v1.0) — descartado junto com o banco |
| Acesso ao Sheets/Drive | **Conta de serviço (service account) do Google Cloud**, com a planilha e a pasta compartilhadas com ela | Permite ao servidor ler/escrever sem depender de um token de usuário expirando; é o padrão para automação server-to-server do Google Workspace | OAuth do próprio Alexandre para leitura/escrita de dados — expiraria e exigiria login recorrente só para o site funcionar |
| Login do admin | **Google OAuth** (NextAuth.js / Auth.js), restrito por allowlist de e-mail | Reaproveita a própria conta Google do Alexandre (a mesma dona da planilha/pasta); sem senha para gerenciar | Usuário/senha custom — exigiria implementar recuperação de senha do zero, sem necessidade |
| Deploy | Vercel, branch `main` = produção | Padrão do Alexandre em todos os projetos web | — |
| Repositório | Novo repo GitHub, ex. `alexandresiqueira/virapagina` | — | — |

**O que roda onde:**
- Renderização das páginas do PDF acontece **no navegador do leitor** (client-side), via PDF.js. O servidor nunca converte o PDF em imagem.
- **Toda** leitura e escrita na planilha e no Drive acontece em **rotas de servidor do Next.js**, usando a credencial da conta de serviço. O navegador nunca fala direto com a API do Google — nem para ler o catálogo público, nem para o admin escrever. Isso evita expor a credencial da conta de serviço e centraliza a lógica de permissão (seção 6).
- Upload do PDF: o admin seleciona o arquivo no navegador, que envia pro servidor (rota de API), que sobe pro Drive usando a conta de serviço.
- Leitura/download do PDF pelo público: o navegador pede pra rota de servidor (`/api/livros/[slug]/pdf`), que busca o arquivo no Drive (via conta de serviço) e transmite (proxy) — o público nunca recebe um link direto do Drive.

**Premissas técnicas a validar:**
1. PDF.js consegue renderizar em canvas, no celular, um PDF de ~40 páginas com imagens em boa resolução (como o livro atual, ~9 MB) sem travar. Validar cedo — se a performance no mobile não for aceitável, a rota de fallback é pré-renderizar as páginas em imagem no upload.
2. A cota gratuita da Google Sheets API (100 requisições de leitura por minuto por projeto, no plano padrão) é suficiente para o tráfego esperado (seção 17) — no volume do Alexandre (dezenas de livros, picos curtos de leitor), isso não deve ser um problema, mas fica documentado como premissa, não como garantia.

---

## 5. Perfis de usuário e matriz de permissões

Dois perfis: **Admin** (Alexandre, e opcionalmente outros e-mails que ele adicionar à allowlist) e **Visitante** (público, sem login).

| Ação | Admin | Visitante |
|---|---|---|
| Ler um livro publicado | ✅ | ✅ |
| Ler um livro despublicado (rascunho) | ✅ | ❌ |
| Ver catálogo de livros publicados | ✅ | ✅ |
| Baixar PDF de livro publicado | ✅ | ✅ |
| Subir novo livro | ✅ | ❌ |
| Editar metadados de livro | ✅ | ❌ |
| Publicar/despublicar livro | ✅ | ❌ |
| Excluir livro | ✅ | ❌ |
| Acessar `/admin` | ✅ (e-mail na allowlist) | ❌ (redireciona para login) |

**Onde essa permissão é aplicada:** como não há RLS de banco (não existe banco relacional), **toda** rota de API que escreve ou lê dado sensível (rascunhos) verifica a sessão do NextAuth no início da própria função, antes de tocar no Sheets/Drive — nunca confiando em checagem feita só no frontend. Rota que esquecer essa checagem é bug de segurança grave; ver seção 20.

**Primeiro administrador (seed):** não há tabela de administradores nem cadastro manual em painel nenhum — o admin é definido inteiramente pela variável de ambiente `ADMIN_ALLOWED_EMAILS` (lista separada por vírgula). Colocar o e-mail Google do Alexandre lá, antes do primeiro deploy, já é suficiente (seção 27).

---

## 6. Autenticação e identidade

- **Identificação:** login com Google (OAuth 2.0), via NextAuth.js/Auth.js. Não existe usuário/senha próprio do produto.
- **Criação de "conta":** não existe — qualquer pessoa pode tentar fazer login com Google, mas só quem tem o e-mail listado em `ADMIN_ALLOWED_EMAILS` recebe uma sessão válida com acesso ao `/admin`. Quem não está na lista, ao logar com Google, é redirecionado de volta para fora do admin com a mensagem "Esse e-mail não tem acesso ao painel." — a tentativa de login em si não precisa ser bloqueada (o Google permite qualquer conta logar), mas a **autorização** pós-login é o que importa.
- **Recuperação de senha:** não se aplica — é sempre o fluxo padrão de login do Google (2FA, recuperação, tudo gerenciado pela própria conta Google do Alexandre).
- **Sessão:** cookie de sessão do NextAuth (JWT ou database session — recomendo JWT, já que não há banco para guardar sessão), expiração padrão de 30 dias com renovação silenciosa. Logout limpa o cookie e redireciona para a home pública.
- **Autorização nas rotas de API** (substituindo RLS, que não existe sem banco relacional):
  - Toda rota sob `/api/admin/*` chama, como primeira linha, uma função `requireAdmin()` que lê a sessão do NextAuth, confere se o e-mail está em `ADMIN_ALLOWED_EMAILS`, e devolve 401/403 antes de qualquer leitura/escrita no Sheets ou Drive caso não esteja.
  - Rotas públicas (`GET /api/livros`, `GET /api/livros/[slug]`, `GET /api/livros/[slug]/pdf`) filtram explicitamente por `publicado = "sim"` na leitura da planilha, **exceto** quando a mesma sessão de admin válida está presente (uso da prévia, critério 8.3) — nesse caso, mostram também rascunhos.
  - A credencial da conta de serviço (JSON da service account) **nunca** é usada no navegador — só dentro das rotas de servidor (`/app/api/**/route.ts`), lida de variável de ambiente.

---

## 7. Modelo de dados

Sem banco relacional — os dados vivem numa única planilha do Google Sheets (uma aba, `livros`), e os arquivos ficam no Google Drive, referenciados pelo ID do arquivo. Não há `.dbml` para este modelo (formato pensado para bancos SQL relacionais); a estrutura abaixo é a fonte de verdade da planilha.

### Planilha `livros` (aba única, linha 1 = cabeçalho)

| Coluna | Tipo (na prática) | Obrigatório | Descrição |
|---|---|---|---|
| A — `id` | texto (UUID gerado pela aplicação) | sim | Identificador único da linha, gerado com `crypto.randomUUID()` no momento da criação — a planilha não gera isso sozinha |
| B — `titulo` | texto | sim | Título de exibição |
| C — `subtitulo` | texto | não | Vazio quando o livro não tem subtítulo |
| D — `slug` | texto | sim | Identificador na URL (`/l/<slug>`); só minúsculas, números e hífen; **unicidade verificada em código** (a aplicação lê todas as linhas antes de criar/editar e rejeita duplicata — a planilha não impõe unicidade sozinha) |
| E — `autor` | texto | sim | Padrão `"Alexandre Siqueira"` se deixado em branco |
| F — `descricao` | texto | não | Usado no catálogo e na meta tag de compartilhamento |
| G — `arquivo_pdf_drive_id` | texto (ID de arquivo do Google Drive) | sim | ID do PDF na pasta do Drive — nunca a URL pública direta do Drive |
| H — `arquivo_pdf_tamanho_bytes` | número | não | Preenchido no upload; vazio se a extração falhar (não bloqueia) |
| I — `capa_drive_id` | texto (ID de arquivo do Google Drive) | não | ID da imagem de capa; vazio até ser gerada (regra 11.1) |
| J — `total_paginas` | número | não | Preenchido no upload, a partir da leitura do PDF |
| K — `publicado` | texto (`"sim"` / `"nao"`) | sim | Controla visibilidade pública — planilha não tem tipo boolean nativo confiável entre client libraries, então uso string fixa em vez de `TRUE`/`FALSE` do Sheets para evitar ambiguidade de parsing |
| L — `criado_por` | texto (e-mail) | sim | E-mail do admin que criou a linha (da sessão do NextAuth) |
| M — `criado_em` | texto (ISO 8601, ex. `2026-09-08T14:30:00Z`) | sim | Gerado pela aplicação no momento da criação |
| N — `atualizado_em` | texto (ISO 8601) | sim | Reescrito pela aplicação a cada edição — **não há trigger de banco**; é a rota de API que sobrescreve este campo em todo `PUT` |

**Estratégia de exclusão:** hard delete — a linha é removida da planilha (`spreadsheets.values.batchUpdate` com remoção de linha, ou marcação + filtro, ver assunção 24.8) e os arquivos correspondentes são apagados do Drive. Sem lixeira/histórico no MVP.

**Unicidade e integridade:** como a planilha não impõe constraints, **toda** validação de unicidade de slug, formato de e-mail, etc. acontece na rota de API antes de gravar — nunca assuma que "se está na planilha, está válido"; a aplicação é a única guardiã da integridade dos dados.

**Concorrência:** cenário de dois admins editando a mesma linha ao mesmo tempo não é tratado no MVP (last write wins) — aceitável dado que há, na prática, um único admin usando o painel esporadicamente.

---

## 8. Épicos e critérios de aceite

### 8.1 Autenticação do admin (Google OAuth)
**Objetivo:** Alexandre consegue entrar no painel com a própria conta Google, e qualquer outro e-mail é bloqueado.

**Fluxo:** acessa `/admin` → sem sessão, redireciona para `/admin/login` → botão único "Entrar com Google" → fluxo padrão do Google (escolher conta, permitir) → volta pro site → se o e-mail está em `ADMIN_ALLOWED_EMAILS`, vai para `/admin/livros`; se não está, volta pra fora com mensagem de acesso negado.

**Critérios de aceite:**
- Acessar qualquer rota `/admin/*` sem sessão válida redireciona para `/admin/login`.
- Login com e-mail Google presente em `ADMIN_ALLOWED_EMAILS` leva a `/admin/livros`.
- Login com e-mail Google **fora** da lista mostra "Esse e-mail não tem acesso ao painel." e não cria sessão de admin (mesmo estando autenticado no Google).
- Botão "Sair" no admin encerra a sessão do NextAuth e volta para a home pública (`/`).
- Nenhuma rota de API sob `/api/admin/*` executa leitura ou escrita no Sheets/Drive antes de confirmar `requireAdmin()` (critério verificável em code review/teste automatizado, seção 22).

### 8.2 Módulo admin — CRUD de livros
**Objetivo:** Alexandre sobe, edita, publica/despublica e exclui livros pelo painel.

**Fluxo (novo livro):** `/admin/livros` → botão "Novo livro" → formulário (título, subtítulo opcional, slug — sugerido automaticamente a partir do título e editável, descrição opcional, seleção do arquivo PDF) → arquivo é enviado pra rota de API, que sobe pro Drive e lê o número de páginas → sistema gera a capa (primeira página renderizada em canvas no navegador, enviada como PNG pra mesma rota) → rota grava a nova linha na planilha `livros`, com `publicado = "nao"` → admin revisa na prévia e clica "Publicar".

**Critérios de aceite:**
- Lista em `/admin/livros` mostra todos os livros (publicados e rascunho), com miniatura da capa, título, status (badge "Publicado"/"Rascunho"), data de atualização, e link "Ver página pública" (só quando publicado).
- Estado vazio (nenhum livro cadastrado): mensagem "Nenhum livro ainda." com botão "Novo livro" em destaque.
- Slug duplicado é rejeitado **no servidor** (a rota de API lê todas as linhas atuais da planilha antes de gravar) com mensagem "Esse link já está em uso, escolha outro." e sugestão de um slug alternativo (`-2`, `-3`...) — validação só no cliente não é suficiente, pois a planilha não garante unicidade sozinha.
- Upload de arquivo que não é PDF é rejeitado no cliente antes de subir, com mensagem "Envie um arquivo PDF.".
- Upload maior que 100 MB é rejeitado com mensagem "Arquivo muito grande (máximo 100 MB)." (ver regra 11.2 e seção 17).
- Barra de progresso do upload reflete o progresso real (não uma animação fake).
- Editar metadados de um livro existente não exige reenviar o PDF (troca de arquivo é uma ação separada, "Substituir PDF", que sobrescreve o arquivo no Drive mantendo o mesmo `arquivo_pdf_drive_id` quando possível, ou grava um novo ID e apaga o antigo).
- Alterar o slug de um livro já publicado mostra aviso: "Isso muda o link público. Quem tinha o link antigo vai receber página não encontrada. Continuar?" — precisa de confirmação explícita.
- Botão "Despublicar" muda `publicado` para `"nao"` sem apagar nada; livro some do catálogo e a URL pública passa a devolver 404.
- Botão "Excluir" pede confirmação nomeando o livro ("Excluir 'Conceitos de Tecnologia...'? Essa ação não pode ser desfeita.") antes de remover a linha da planilha e os arquivos do Drive.

### 8.3 Leitura pública — visualizador flipbook
**Objetivo:** qualquer pessoa com o link abre o livro e folheia com a experiência de um flipbook real.

**Fluxo:** acessa `/l/<slug>` → rota de servidor lê a planilha, encontra a linha pelo slug, confere `publicado` (ou sessão de admin válida) → devolve metadados → frontend busca o PDF via `/api/livros/[slug]/pdf` (proxy do Drive) → mostra capa/primeira página com animação de carregamento enquanto renderiza → pessoa folheia clicando nas bordas, arrastando, usando as setas do teclado (desktop) ou deslizando (mobile).

**Critérios de aceite:**
- Slug inexistente ou de livro despublicado (para visitante sem sessão de admin) mostra página 404 com mensagem "Esse livro não está disponível." e link para o catálogo (`/`).
- Em telas ≥ 1024px de largura, o livro abre em modo de página dupla (espelhando o efeito de livro físico); abaixo disso, abre em modo página única.
- Clicar/tocar na borda direita ou esquerda da página vira para a próxima/anterior; arrastar a borda produz a animação de virar em tempo real (comportamento nativo do `react-pageflip`).
- Setas do teclado ← → navegam entre páginas quando o foco está no visualizador (desktop).
- Swipe horizontal navega entre páginas no mobile.
- Título e autor do livro aparecem no cabeçalho da página, acima do visualizador.
- Indicador de página atual / total (“12 de 44”) fica visível e atualiza a cada virada.
- Enquanto o PDF ainda está carregando, mostra um estado de carregamento (esqueleto ou spinner) em vez de tela em branco.

### 8.4 Ações do leitor: zoom, tela cheia, download, impressão, compartilhar
**Objetivo:** replicar as ações que o Heyzine oferece na barra de ferramentas.

**Critérios de aceite:**
- Botão "+" e "-" de zoom aumentam/diminuem a escala de renderização das páginas em incrementos de 25%, entre 75% e 250%; o zoom aplicado persiste ao virar de página.
- Botão de tela cheia usa a Fullscreen API do navegador; em navegadores/dispositivos sem suporte (alguns mobile), o botão fica oculto em vez de quebrar.
- Botão "Baixar" chama `/api/livros/[slug]/pdf?download=1`, que transmite o arquivo do Drive com `Content-Disposition: attachment` e nome do arquivo igual ao título do livro — a URL do Drive nunca é exposta ao navegador.
- Botão "Imprimir" abre `/api/livros/[slug]/pdf` em nova aba (o visualizador nativo do navegador assume a impressão) — não tenta implementar impressão customizada do flipbook.
- Botão "Compartilhar": em dispositivo com suporte à Web Share API, abre o menu nativo de compartilhamento do sistema com o link da página; sem suporte (a maioria dos desktops), copia o link para a área de transferência e mostra confirmação "Link copiado.".
- Todos os botões têm rótulo acessível (`aria-label`) além do ícone, para leitor de tela.

### 8.5 Catálogo público
**Objetivo:** quem chega na home sem link direto encontra os livros publicados.

**Critérios de aceite:**
- `/` lista todos os livros com `publicado = "sim"`, ordenados por `criado_em` decrescente (mais recente primeiro), mostrando capa, título, subtítulo e autor.
- Clicar num item do catálogo leva para `/l/<slug>`.
- Estado vazio (nenhum livro publicado ainda): mensagem simples, sem erro.

---

## 9. Fluxos principais ponta a ponta

**Publicar um livro novo, do zero:**
1. Alexandre acessa `/admin/livros`, clica "Novo livro".
2. Preenche título; slug é sugerido automaticamente (kebab-case do título) e pode editar.
3. Seleciona o arquivo PDF do computador; upload inicia (vai pro servidor, que sobe pro Drive), barra de progresso.
4. Ao concluir o upload, sistema extrai total de páginas e gera a capa a partir da primeira página (regra 11.1), enviando também pro Drive.
5. Rota de API grava a nova linha na planilha `livros` como rascunho (`publicado = "nao"`); Alexandre é redirecionado para a tela de edição do livro, com prévia "Ver como ficaria" (abre `/l/<slug>` mesmo despublicado, só pra ele, via sessão de admin autenticada).
6. Confere a prévia; se estiver tudo certo, volta e clica "Publicar".
7. Livro aparece no catálogo público e a URL `/l/<slug>` passa a responder para qualquer visitante.

**Caminho de exceção — upload falha no meio (conexão cai):** o formulário mostra erro "Não foi possível concluir o envio. Tente novamente." e mantém os campos preenchidos (não perde o que já foi digitado); nenhuma linha é escrita na planilha até o upload do PDF terminar com sucesso no Drive.

**Caminho de exceção — planilha ou pasta do Drive foi renomeada/movida/desconectada da conta de serviço:** qualquer rota de API que falhar ao acessar o Sheets/Drive devolve erro genérico ao usuário ("Algo deu errado. Tente novamente em instantes.") e registra o erro real em log de servidor — nunca expõe detalhe técnico da API do Google na tela.

---

## 10. Inventário de telas

| Tela | Perfil | O que mostra | Lê | Escreve |
|---|---|---|---|---|
| `/` — Catálogo | Visitante, Admin | Grade de livros publicados (capa, título, subtítulo, autor) | Planilha `livros` (só `publicado = "sim"`) | — |
| `/l/[slug]` — Leitor | Visitante, Admin | Visualizador flipbook, título/autor, barra de ferramentas (zoom, tela cheia, download, imprimir, compartilhar) | Planilha `livros`, arquivo no Drive (via proxy) | — |
| `/admin/login` — Login | Admin (deslogado) | Botão único "Entrar com Google" | — (delega ao Google OAuth) | — |
| `/admin/livros` — Lista de livros | Admin | Tabela/grade de todos os livros (publicado e rascunho), com ações rápidas | Planilha `livros` (todas as linhas) | — |
| `/admin/livros/novo` — Novo livro | Admin | Formulário de criação + upload de PDF | Planilha `livros` (checagem de slug) | Planilha `livros`, Drive (pasta de PDFs e de capas) |
| `/admin/livros/[id]` — Editar livro | Admin | Formulário de edição, prévia, publicar/despublicar, substituir PDF, excluir | Planilha `livros` | Planilha `livros`, Drive |

---

## 11. Regras de negócio

| # | Regra | Onde se aplica |
|---|---|---|
| 11.1 | A capa do livro é gerada automaticamente renderizando a primeira página do PDF em canvas (client-side, no momento do upload) e enviando o resultado como PNG pra rota de API, que sobe pro Drive. Não há upload manual de capa no MVP. | Frontend (admin) + rota de API |
| 11.2 | Tamanho máximo de arquivo PDF: 100 MB. Acima disso, upload é rejeitado antes de iniciar o envio. | Frontend (admin) |
| 11.3 | O slug é gerado automaticamente a partir do título (kebab-case, sem acento, minúsculo) quando o campo é deixado em branco, mas é sempre editável antes de salvar. | Frontend (admin) |
| 11.4 | Um livro só aparece no catálogo público e responde na URL pública quando `publicado = "sim"`. Não existe estado intermediário (ex. "agendado para publicar depois"). | Rota de API (checagem manual, sem RLS) + frontend |
| 11.5 | O zoom do visualizador varia entre 75% e 250%, em passos de 25%, começando em 100%. | Frontend (leitor) |
| 11.6 | Excluir um livro remove a linha da planilha e os arquivos correspondentes no Drive (PDF e capa), nessa ordem (arquivo só é removido depois que a exclusão da linha é confirmada, pra nunca ficar com metadado apontando para arquivo inexistente). | Rota de API de exclusão |
| 11.7 | Toda leitura da planilha que alimenta uma tela pública (catálogo, leitor) é cacheada por, no mínimo, 60 segundos (Next.js `revalidate`), para não estourar a cota da Sheets API em picos de tráfego. Ações do admin (criar/editar/excluir) invalidam esse cache imediatamente. | Rota de API / Next.js |

Nenhuma dessas regras envolve cálculo numérico além dos limites fixos acima — não há fórmula a inferir.

---

## 12. Máquinas de estado

**Estado de um livro (`publicado`, coluna K da planilha):**

```
[recém-criado] → publicado = "nao" (rascunho)
      │
      │ admin clica "Publicar"
      ▼
  publicado = "sim"
      │
      │ admin clica "Despublicar"
      ▼
  publicado = "nao" (volta a rascunho, mas continua existindo)
```

Não há estado de "arquivado" nem "agendado" no MVP — só rascunho e publicado, alternável livremente pelo admin.

---

## 13. Contratos de API e tipos

Como não há acesso direto do navegador ao Sheets/Drive, **toda** a superfície de dados do produto passa por estas rotas de servidor:

### Públicas (sem autenticação)

**`GET /api/livros`**
- Devolve a lista de livros com `publicado = "sim"`, ordenada por `criado_em` decrescente.
- Cache: `revalidate = 60` (regra 11.7).

**`GET /api/livros/[slug]`**
- Devolve os metadados de um livro pelo slug.
- Se `publicado = "nao"` e não há sessão de admin válida na requisição: 404.
- Cache: `revalidate = 60`, exceto quando há sessão de admin (nunca cacheia prévia de rascunho).

**`GET /api/livros/[slug]/pdf`**
- Transmite (proxy) o arquivo PDF do Drive, usando `arquivo_pdf_drive_id` da linha correspondente.
- Parâmetro opcional `?download=1`: adiciona `Content-Disposition: attachment; filename="<titulo>.pdf"`. Sem o parâmetro, serve inline (para o PDF.js e para o botão "Imprimir").
- Mesma regra de visibilidade do endpoint acima (404 se rascunho sem sessão de admin).

**`GET /api/livros/[slug]/capa`**
- Transmite (proxy) a imagem de capa do Drive, usando `capa_drive_id`.

### Admin (exigem `requireAdmin()`, seção 6)

**`POST /api/admin/livros`** — cria um livro novo (rascunho). Recebe metadados + arquivo PDF (multipart) + imagem de capa gerada no cliente. Valida unicidade de slug antes de gravar (regra citada em 8.2).

**`PUT /api/admin/livros/[id]`** — atualiza metadados de um livro existente. Se o slug mudou, revalida unicidade.

**`POST /api/admin/livros/[id]/substituir-pdf`** — troca o arquivo PDF de um livro existente, sem alterar metadados. Recalcula `total_paginas` e `arquivo_pdf_tamanho_bytes`.

**`POST /api/admin/livros/[id]/publicar`** e **`POST /api/admin/livros/[id]/despublicar`** — alternam o campo `publicado`.

**`DELETE /api/admin/livros/[id]`** — remove a linha da planilha e os arquivos do Drive (regra 11.6).

Todas as rotas `/api/admin/*` devolvem 401 se não houver sessão, 403 se houver sessão mas o e-mail não estiver na allowlist.

---

## 14–15. Exportação e Copy

Não aplicável no MVP (sem exportação de dados; textos da interface são poucos e listados aqui como copy final):

| Contexto | Texto |
|---|---|
| Catálogo vazio | "Nenhum livro publicado ainda." |
| Lista admin vazia | "Nenhum livro ainda." (botão: "Novo livro") |
| Acesso negado no login | "Esse e-mail não tem acesso ao painel." |
| Slug duplicado | "Esse link já está em uso, escolha outro." |
| Upload não-PDF | "Envie um arquivo PDF." |
| Upload grande demais | "Arquivo muito grande (máximo 100 MB)." |
| Confirmação de exclusão | "Excluir "{título}"? Essa ação não pode ser desfeita." |
| Aviso de troca de slug | "Isso muda o link público. Quem tinha o link antigo vai receber página não encontrada. Continuar?" |
| Link copiado | "Link copiado." |
| Livro indisponível (404 público) | "Esse livro não está disponível." |
| Erro de upload | "Não foi possível concluir o envio. Tente novamente." |
| Erro genérico de integração com Google | "Algo deu errado. Tente novamente em instantes." |

---

## 16. Direção visual

Sem marca própria definida ainda — decisão consciente de manter o Virapágina neutro no MVP (é uma ferramenta de distribuição, não um produto com identidade própria a construir agora). Livre para o agente de código:

- Paleta neutra (tons de cinza/branco/preto), com um único tom de destaque para botões primários e estado ativo — sugestão: o mesmo azul usado nos outros materiais do Alexandre, mas isso é livre.
- Tipografia: fonte padrão do sistema ou uma sans-serif simples (Inter, por exemplo) — sem necessidade de fonte manuscrita ou hand-drawn aqui (esse estilo é do conteúdo dos livros, não da casca do produto).
- O admin usa o **padrão de menu lateral estilo App Store Connect** (grupos em negrito escuro, itens indentados sem marcador, hairline entre grupos, item ativo na cor de destaque) — grupo único "Livros" no MVP (não há mais seções ainda).
- A página pública do leitor (`/l/[slug]`) e o catálogo (`/`) **não** usam navegação lateral — são páginas consumer simples, barra de ferramentas superior/inferior conforme o padrão de um leitor de flipbook (ver referência visual do próprio Heyzine, screenshots já compartilhados na conversa).

---

## 17. Requisitos não-funcionais

- **Performance:** primeira página do livro visível em até 3s em conexão 4G comum, para um PDF de até 50 páginas / 15 MB.
- **Tamanho de arquivo:** PDFs até 100 MB (regra 11.2).
- **Responsivo:** funcional em telas de 360px (celular pequeno) a 2560px (monitor grande); modo página única abaixo de 1024px (critério 8.3).
- **Navegadores:** últimas 2 versões de Chrome, Safari (incl. iOS), Firefox, Edge. Fullscreen API pode não existir em iOS Safari — botão oculto nesse caso (critério 8.4), sem quebrar o resto da página.
- **Acessibilidade:** todos os botões de ação com `aria-label`; contraste mínimo AA nos textos da interface; zoom da página (regra 11.5) serve também como ajuste de acessibilidade visual.
- **Volume esperado:** dezenas de livros cadastrados, tráfego de leitor esporádico e em picos curtos (logo depois de um post no LinkedIn) — nada que exija otimização de escala além do que Vercel + cache de 60s (regra 11.7) já entregam.
- **Cota da Google Sheets API:** 100 requisições de leitura por minuto por projeto (padrão gratuito) — o cache da regra 11.7 existe justamente para manter o uso bem abaixo desse teto mesmo em pico de tráfego.
- **Idioma:** interface em português (pt-BR) no MVP; sem i18n.

---

## 18. Convenções de código, documentação e estrutura do repositório

- **Nomenclatura de dados em português:** mesmo sem banco relacional, os nomes de campo da planilha e os tipos TypeScript que os espelham seguem português, `snake_case` (`titulo`, `publicado`, `criado_em`), pela mesma razão de sempre — consistência entre o que o Alexandre vê na planilha e o que o código manipula.
- **Código em inglês:** componentes, hooks, funções e arquivos do Next.js em inglês (`BookReader.tsx`, `useBookUpload.ts`), seguindo o padrão de mercado.
- **Comentários obrigatórios:** toda função, hook e rota de servidor leva comentário de cabeçalho em português explicando o que faz e qual regra do spec implementa (ex. `// Gera o slug a partir do título — regra 11.3`).
- **Estrutura de pastas esperada:**
  ```
  /app
    /(public)
      /page.tsx                          → catálogo
      /l/[slug]/page.tsx                 → leitor
    /admin
      /login/page.tsx
      /livros/page.tsx
      /livros/novo/page.tsx
      /livros/[id]/page.tsx
    /api
      /livros/route.ts                   → GET lista pública
      /livros/[slug]/route.ts            → GET metadados
      /livros/[slug]/pdf/route.ts        → GET proxy do PDF
      /livros/[slug]/capa/route.ts       → GET proxy da capa
      /admin/livros/route.ts             → POST criar
      /admin/livros/[id]/route.ts        → PUT atualizar, DELETE excluir
      /admin/livros/[id]/substituir-pdf/route.ts
      /admin/livros/[id]/publicar/route.ts
      /admin/livros/[id]/despublicar/route.ts
      /auth/[...nextauth]/route.ts
  /components
    /reader   (BookReader, FlipbookToolbar, ZoomControls...)
    /admin    (BookForm, BookList, BookTable...)
  /lib
    /google
      sheets.ts       → cliente da Sheets API + funções de leitura/escrita da aba livros
      drive.ts        → cliente da Drive API + upload/download/exclusão de arquivo
      auth.ts         → requireAdmin() e configuração do NextAuth
    /pdf
      render.ts       → helpers de renderização PDF.js e geração de capa
  /types
    livro.ts
  ```
- **Documentação viva:** `README.md` com setup local, variáveis de ambiente, e o passo a passo de configuração do Google Cloud (service account, APIs habilitadas, compartilhamento da planilha/pasta — seção 27). `DOCUMENTACAO-TECNICA.md` (seção 19) e `CLAUDE.md` na raiz.
- **`CLAUDE.md`:** convenções acima, mapa de arquitetura (seção 4), comando de typecheck, pegadinhas a não quebrar: (1) renderização de PDF é sempre client-side (princípio 0.1); (2) **nenhuma** chamada ao Sheets/Drive acontece direto do navegador — sempre via rota de servidor (princípio 0.3 + seção 6); (3) toda rota admin precisa chamar `requireAdmin()` como primeira linha.
- **Variáveis de ambiente:**
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL` (secreta)
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (secreta)
  - `GOOGLE_SHEET_ID` (pública, mas sem risco em vazar sozinha — o acesso depende da credencial acima)
  - `GOOGLE_DRIVE_FOLDER_ID` (idem)
  - `ADMIN_ALLOWED_EMAILS` (secreta — lista separada por vírgula)
  - `GOOGLE_OAUTH_CLIENT_ID` (pública)
  - `GOOGLE_OAUTH_CLIENT_SECRET` (secreta)
  - `NEXTAUTH_SECRET` (secreta)
  - `NEXTAUTH_URL` (pública — URL do deploy)

---

## 19. Documento de documentação técnica

Ao final da implementação, o agente de código deve gerar `DOCUMENTACAO-TECNICA.md` na raiz, em português, com: (1) estrutura da planilha `livros` explicada em linguagem de negócio (o que cada coluna significa); (2) como a autorização funciona sem banco (allowlist + `requireAdmin()`, seção 6); (3) lista de todas as rotas de API (seção 13) com o que cada uma valida antes de agir; (4) mapa tela → rotas de API (a partir da seção 10 e 13); (5) lógica das principais funcionalidades por tela; (6) divergências em relação a este spec. Atualizar no mesmo commit de qualquer mudança de rota, coluna da planilha ou lógica de tela.

---

## 20. Privacidade, segurança e conformidade

- **Dados coletados:** só os metadados dos livros (público, na planilha) e o e-mail Google de quem loga no admin (via sessão do NextAuth, não persistido em lugar nenhum além do cookie de sessão). Nenhum dado pessoal de leitor é coletado no MVP — não há cadastro, cookie de rastreamento ou analytics de terceiro.
- **Onde ficam os dados:** planilha e pasta na conta Google pessoal do Alexandre — fora do controle direto do código, mas dentro do ecossistema que ele já usa e confia.
- **Quem acessa:** a planilha e a pasta do Drive precisam estar **compartilhadas com o e-mail da conta de serviço** (não é o e-mail do Alexandre; é um e-mail técnico gerado pelo Google Cloud, tipo `virapagina@<projeto>.iam.gserviceaccount.com`) com permissão de Editor. Sem esse compartilhamento, a aplicação não consegue ler nem escrever nada.
- **Segredos:** `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` é a credencial mais sensível do projeto — dá acesso de escrita à planilha e à pasta inteira. Fica só como variável de ambiente na Vercel, nunca commitada, nunca logada, nunca exposta ao cliente. Rotacionar (gerar nova chave, revogar a antiga) se houver qualquer suspeita de vazamento.
- **Superfície de ataque sem RLS:** como não existe política de banco garantindo a visibilidade dos dados, **toda** a segurança de "rascunho não aparece pra visitante" depende do código das rotas de API estar correto (seção 6/13). Isso é uma responsabilidade maior do que teria com Supabase + RLS — reforçar com teste automatizado (seção 22) é mais importante aqui do que seria com banco relacional.
- **LGPD:** como não há coleta de dado pessoal de visitante, não há tratamento especial de titular de dados a implementar no MVP. Se analytics de leitor entrar no roadmap (seção 28), essa seção precisa ser revisada.

---

## 21. Métricas de sucesso

- Tempo entre "PDF pronto" e "link publicado e compartilhável": alvo menor que 10 minutos (hoje, via Heyzine, é rápido — o Virapágina não pode ser mais lento que isso pra valer a pena).
- Nenhuma dependência de custo recorrente de terceiro para servir os livros (substitui a mensalidade do Heyzine) — sucesso é simplesmente: Alexandre para de pagar o Heyzine e usa o Virapágina no lugar, sem perda de funcionalidade percebida.

---

## 22. Estratégia de teste

- Teste manual do fluxo ponta a ponta (seção 9) antes de cada deploy em produção, dado o volume baixo de uso.
- **Teste automatizado prioritário, mais do que seria com banco relacional:** cobrir `requireAdmin()` e as rotas `/api/admin/*` — garantir que uma requisição sem sessão, ou com sessão de e-mail fora da allowlist, recebe 401/403 e **não** chega a chamar Sheets/Drive. Sem RLS de banco, esse teste é a única rede de segurança real.
- Testar também que `GET /api/livros/[slug]` e `/pdf` devolvem 404 para um slug com `publicado = "nao"` quando não há sessão de admin.
- Testar especificamente em pelo menos um iPhone real (Safari) e um Android real (Chrome), dado que boa parte da audiência lê no celular — emulador não é suficiente para validar gesto de swipe e Fullscreen API.

---

## 23. Riscos e mitigação

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| PDF.js não performa bem no mobile com PDFs grandes/pesados de imagem | Alto (experiência de leitura ruim, o motivo todo do produto) | Média | Validar cedo (premissa da seção 4); se necessário, mudar para pré-renderização de imagens no upload |
| **Planilha como banco de dados não escala** — se o volume de livros crescer muito (centenas) ou o tráfego público disparar, ler/filtrar a planilha inteira a cada requisição fica lento e esbarra na cota da API | Médio | Baixa no volume atual do Alexandre; sobe se o produto virar algo maior (ver roadmap de multi-tenant) | Cache de 60s (regra 11.7) resolve o caso comum; se crescer de verdade, migrar pra Postgres/Supabase é o caminho — arquitetura em rotas de API (seção 13) já isola o acesso a dados, então trocar a implementação interna de `/lib/google/sheets.ts` por um cliente de banco não deveria exigir reescrever as telas |
| **Segurança de rascunho depende inteiramente do código**, sem RLS de banco como segunda camada | Alto (vazamento de conteúdo não publicado) | Baixa, se o teste automatizado da seção 22 for implementado e mantido | Teste automatizado cobrindo `requireAdmin()` e as regras de visibilidade; nunca pular esse teste em nome de velocidade |
| Conta de serviço perder acesso (planilha/pasta desconectada, reorganizada, credencial expirada/revogada) | Alto (site para de funcionar inteiramente) | Baixa | Erro genérico ao usuário + log de servidor (fluxo de exceção da seção 9); documentar claramente o passo de compartilhamento no README (seção 27) |
| `react-pageflip` não suportar bem alguma combinação de navegador/gesto | Médio | Baixa | Biblioteca madura e amplamente usada; se um bug específico aparecer, isolar e reportar/patchear localmente |
| Upload de PDF grande (perto de 100 MB) falhar em conexão instável | Médio | Média | Mensagem de erro clara (critério 8.2) sem perder o formulário preenchido; sem retry automático no MVP |

---

## 24. Assunções declaradas

> Assunção não revisada vira verdade no minuto em que o agente de código começa a codar — revise esta lista antes de colar o spec no Claude Code.

1. **Nome do produto:** assumi "Virapágina", seguindo o padrão de nomes em português dos seus outros apps (Quando Vence?, Vou Nadar). Se quiser outro nome, é só avisar antes de gerar o repositório.
2. **"Aumentar a fonte" = zoom da página, não texto reflowable.** Como o conteúdo é um PDF renderizado em canvas (não HTML), implementei como zoom da página inteira (regra 11.5) — mesmo comportamento do ícone de lupa do Heyzine nos prints que você mandou.
3. **Login do admin via Google OAuth, sem senha própria** — decisão tomada nesta conversa como consequência natural de usar Google Sheets/Drive; se preferir usuário/senha simples em vez disso, é uma mudança pequena (troca só a seção 6 e o épico 8.1).
4. **Conta de serviço (service account) separada da sua conta Google pessoal**, com a planilha e a pasta compartilhadas explicitamente com ela — é o padrão recomendado do Google para automação server-to-server; a alternativa (usar OAuth da sua própria conta para o servidor também) exigiria você re-autenticar periodicamente, o que quebraria o site sozinho de tempos em tempos.
5. **Sem domínio próprio no MVP** — roda inicialmente no domínio padrão da Vercel; conectar domínio próprio é configuração de poucos minutos quando quiser.
6. **Capa gerada automaticamente da primeira página** (regra 11.1), sem opção de upload manual de capa no MVP.
7. **Botão de compartilhar sem atalhos de rede social fixos** — só Web Share API + copiar link.
8. **Exclusão de linha na planilha via Google Sheets API:** a API do Sheets não tem um "DELETE row" direto simples feito para um único ID arbitrário — a implementação vai precisar localizar o índice da linha pelo `id` no momento da exclusão e usar `batchUpdate` com uma requisição `deleteDimension`. Documentei isso como detalhe de implementação esperado, não como decisão de produto, mas registro aqui porque é uma pegadinha técnica real da Sheets API que vale o agente de código já saber de antemão.
9. **Sem migração de dados do Heyzine** — o Virapágina começa vazio; o primeiro livro (o PDF do livro de tecnologia) é cadastrado manualmente como teste, e as publicações antigas do Heyzine continuam onde estão (ou saem do ar quando o plano for cancelado) sem migração automática.

---

## 25. Perguntas abertas

O agente de código deve **perguntar em vez de assumir** ao encontrar qualquer um destes pontos:

1. **Nome final do produto** — confirmar "Virapágina" ou outro nome antes de nomear o repositório e o `package.json`.
2. **Domínio:** usar só o domínio padrão da Vercel, ou já conectar um domínio/subdomínio próprio (ex. `livros.dablab.com.br`) desde o primeiro deploy?
3. **Qual planilha e pasta do Drive usar:** criar uma planilha e uma pasta novas e dedicadas (recomendado, mesmo princípio de isolamento que valia para "projeto Supabase novo" na v1.0), ou reaproveitar alguma estrutura de Drive já existente do Alexandre?

---

## 26. Definition of Done

- [ ] Todos os épicos da seção 8 implementados e validados contra seus critérios de aceite.
- [ ] Planilha `livros` seguindo exatamente as colunas da seção 7, sem coluna fora do padrão.
- [ ] Todas as rotas de API (seção 13) comentadas em português, incluindo o que cada uma valida.
- [ ] `DOCUMENTACAO-TECNICA.md` gerado e conferido contra o sistema implementado.
- [ ] `CLAUDE.md` criado e README em dia, incluindo o passo a passo de configuração do Google Cloud (seção 27).
- [ ] Teste automatizado de `requireAdmin()` e das regras de visibilidade de rascunho (seção 22) implementado e passando — **não negociável dado o risco da seção 23**.
- [ ] Fluxo ponta a ponta da seção 9 testado manualmente: upload → publicação → leitura pública → download → compartilhar.
- [ ] Testado em pelo menos um iPhone e um Android reais (seção 22).
- [ ] O PDF do livro *Conceitos de Tecnologia para Pessoas Executivas e Não Técnicas* publicado com sucesso como primeiro título real da plataforma.

---

## 27. Próximos passos operacionais

1. Alexandre revisa as seções 24 (Assunções) e 25 (Perguntas abertas) desta spec.
2. **Configurar o Google Cloud:**
   - Criar (ou reaproveitar) um projeto no Google Cloud Console.
   - Habilitar a **Google Sheets API** e a **Google Drive API** para o projeto.
   - Criar uma **conta de serviço** (Service Account), gerar uma chave JSON.
   - Configurar a tela de consentimento OAuth e criar um **OAuth Client ID** (tipo "Web application"), para o login do admin — separado da conta de serviço.
3. Criar a planilha `livros` no Google Sheets (com o cabeçalho da seção 7) e a pasta no Google Drive; **compartilhar ambas com o e-mail da conta de serviço**, permissão de Editor.
4. Definir `ADMIN_ALLOWED_EMAILS` com o e-mail Google do Alexandre.
5. Criar o repositório GitHub.
6. Colar o prompt de implementação (abaixo) no Claude Code, apontando pro repositório vazio, com as variáveis de ambiente (seção 18) já em mãos.
7. Conectar o repositório à Vercel, configurar as variáveis de ambiente, deploy.
8. Fazer o upload do PDF do livro como primeiro teste real de ponta a ponta.
9. Trocar o link do Heyzine pelo link do Virapágina no post/divulgação.

---

## 28. Roadmap: próximas releases

- **Múltiplos administradores:** hoje já dá pra adicionar um segundo e-mail em `ADMIN_ALLOWED_EMAILS`, mas sem tela de gestão disso — vira feature de verdade se precisar escalar.
- **Analytics de leitura:** quantas aberturas por livro, até que página as pessoas costumam ler, de onde veio o clique (referrer). Adiar até haver necessidade real de medir.
- **Multi-tenant / white-label:** transformar o Virapágina num produto que outros clientes da Dab Lab possam usar. Fora do MVP — validar primeiro o uso pessoal.
- **Migração da planilha para um banco relacional** (Postgres/Supabase), se o volume de livros ou tráfego crescer a ponto de a planilha virar gargalo real (ver risco da seção 23). A separação em `/lib/google/sheets.ts` já isola essa troca do resto do app.
- **Grade de miniaturas de página** (ícone de "grid" do Heyzine) para pular direto a uma página.
- **Capa customizável manualmente**, além da geração automática da primeira página.
- **Atalhos fixos de compartilhamento** (WhatsApp, LinkedIn, X) na barra de ferramentas, além da Web Share API.
- **Domínio/subdomínio próprio** conectado (ex. `livros.dablab.com.br`), se ainda não tiver sido feito no MVP.
- **Áudio de fundo / som de virar página**, se fizer sentido pela experiência (o Heyzine tem o ícone de som nos prints compartilhados).

---

## 29. Protocolo de mudanças incrementais

Depois que o v1 estiver no ar, para qualquer ajuste:

1. Commit de checkpoint antes de qualquer mudança (`git commit` limpo), para ter um `git diff` confiável depois.
2. Não colar este spec inteiro de novo — colar só o trecho novo ou um spec adicional específico da feature (ex. "spec adicional: grade de miniaturas de página").
3. Escrever a instrução como diff sobre o que já existe, deixando explícito que o projeto já está implementado e funcionando — não é um recomeço.
4. Dizer explicitamente o que **não** deve mudar (ex. "não alterar o fluxo de autenticação, só a tela de listagem de livros").
5. Pedir a lista de arquivos que serão criados/alterados **antes** de gerar código, e aprovar antes de continuar.
6. Revisar o `git diff` contra o combinado; reverter qualquer arquivo fora do escopo pedido.
7. Exigir a atualização do `DOCUMENTACAO-TECNICA.md` no mesmo commit da mudança.

**Modelo de prompt para mudança incremental:**
```
O projeto Virapágina já existe e está em produção. Não é um recomeço.

Mudança pedida: <descrição curta>
Spec adicional (se houver): <colar aqui>

Não altere: <partes explicitamente fora do escopo>

Antes de codar: liste os arquivos que serão criados/alterados e aguarde minha aprovação.
Ao final: atualize o DOCUMENTACAO-TECNICA.md refletindo a mudança.
```

---

## Anexo — Fontes

- Heyzine — página de preços e planos, consultada em 08/09/2026 (via Capterra e TechJockey): plano sem marca d'água a partir de ~US$14/mês.
- `react-pageflip` (npm) — biblioteca de efeito de flipbook em React, MIT license.
- `pdfjs-dist` (npm) — biblioteca de renderização de PDF da Mozilla.
- Google Sheets API v4 e Google Drive API v3 — documentação oficial do Google Cloud (cotas padrão, autenticação via service account).

---

# Prompt de implementação (colar no Claude Code)

```
Leia o arquivo spec.md inteiro antes de escrever qualquer código.

Antes de codar: monte um plano e uma lista de tarefas e me mostre para aprovação.

Ordem de implementação:
1. Seção 18 (estrutura de pastas) + seção 6 (auth.ts, requireAdmin()) + seção 13 (lib/google/sheets.ts e lib/google/drive.ts) — a camada de acesso a dados e autorização primeiro, sempre, antes de qualquer tela.
2. Seção 8.1 (autenticação do admin via Google OAuth).
3. Seção 8.2 (CRUD de livros no admin).
4. Seção 8.3 e 8.4 (leitor público: flipbook, zoom, tela cheia, download, imprimir, compartilhar).
5. Seção 8.5 (catálogo público).

Escopo: implemente exatamente o que está nas seções 3 (dentro do MVP), 8, 9, 10, 11 e 13.
Não implemente nada da seção 28 (Roadmap) — está fora do MVP por decisão explícita.

Princípios da seção 0 são a regra de desempate para qualquer dúvida de UX ou arquitetura — em especial o princípio 0.3: não há banco relacional, os dados vivem em Google Sheets e os arquivos em Google Drive, e TODA chamada a essas APIs acontece em rota de servidor, nunca no navegador.

Convenções obrigatórias:
- Nomes de campo em português (mesmo sem banco relacional) nos tipos TypeScript que espelham a planilha (seção 18).
- Código, variáveis, componentes e nomes de arquivo em inglês.
- Toda função, hook e rota de servidor leva comentário de cabeçalho em português explicando o que faz e qual regra do spec implementa (com o número da seção).
- Toda rota sob /api/admin/* chama requireAdmin() como primeira linha, antes de qualquer leitura/escrita no Sheets ou Drive — sem exceção.
- Siga literalmente as tabelas de permissões (seção 5), regras de negócio (seção 11) e critérios de aceite (seção 8) — não invente valores, limites ou comportamento que não estejam escritos.

Segurança é mais crítica aqui do que num projeto com banco relacional, porque não há RLS como segunda camada de defesa (seção 20/23): implemente e rode o teste automatizado da seção 22 cobrindo requireAdmin() e a visibilidade de rascunhos ANTES de considerar o épico 8.1/8.2 concluído.

Antes de avançar de um épico para o outro, valide cada critério de aceite da seção 8 correspondente.

Se encontrar qualquer item da seção 25 (Perguntas abertas), pergunte a mim em vez de assumir uma resposta.

Ao final da implementação, gere DOCUMENTACAO-TECNICA.md na raiz do projeto, em português, com os seis itens da seção 19, escritos a partir do que foi realmente implementado (não do que foi planejado).
```
