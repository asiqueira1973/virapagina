---
Documento: spec.md — Virapágina
Versão: 3.0
Responsável de produto: Alexandre Siqueira
Status: aprovado para implementação
Data: 2026-09-09
---

# Virapágina — Especificação de Software (SDD)

## Como usar este documento

Este `spec.md` é a fonte única de verdade do produto **Virapágina**: uma plataforma de flipbooks (livros digitais em PDF com efeito de virar página), onde qualquer pessoa cria conta, sobe seus PDFs e recebe um link público para distribuir.

Destina-se a ser consumido por um agente de código (Claude Code). A **seção 24 (Assunções declaradas)** deve ser revisada por Alexandre **antes** de a implementação continuar — assunção não revisada vira verdade no minuto em que o agente começa a codar. A **seção 25 (Perguntas abertas)** lista o que só Alexandre pode decidir.

### Histórico de versões

| Versão | O que era |
|---|---|
| 1.0 | Ferramenta pessoal. Supabase (Postgres + Auth + Storage + RLS). Um único admin. |
| 2.0 | Ferramenta pessoal. Google Sheets (dados) + Google Drive (arquivos), login Google por allowlist. **Implementada e funcionando.** |
| **3.0** | **Produto multi-tenant.** Firestore + Firebase Storage. Qualquer pessoa cria conta. URL pública passa a ser `/<usuário>/<slug>`. Plano gratuito de 5 livros, com limite aplicado. **Sem cobrança** — o desenho da cobrança está pronto em `EPICO-COBRANCA.md` e entra numa versão futura. |

### O que a v3.0 muda, em uma frase

O Virapágina deixa de ser a ferramenta que o Alexandre usa para publicar os livros dele e passa a ser um produto que outras pessoas usam. Isso reverbera em tudo: identidade, modelo de dados, URL pública, permissões, privacidade e riscos.

### Por que sem cobrança

Decisão do dono, em 8 de setembro de 2026: *"a versão 1 pode nascer sem cobrança; ninguém vai usar mesmo"*. Construir a esteira de pagamento antes do primeiro usuário é montar linha de produção para uma fábrica que ainda não abriu.

O desenho **inteiro** da cobrança — faixas, preços, Stripe, webhook idempotente, reconciliação, rebaixamento, cortesia e nota fiscal — está em **`EPICO-COBRANCA.md`**, na raiz. Nada foi perdido; foi separado. Duas coisas do MVP existem justamente para que aquele dia seja curto:

- O campo `plano` e o **limite já aplicado** (regra 11.8). Retrofitar um limite em contas que já existem é a parte que dói fazer depois.
- A **medição de tráfego por conta** (regra 11.11). A cobrança lê a medição; ela não a produz.

### O que da v2.0 continua valendo, sem alteração

O leitor. `BookReader`, `PdfPage`, a barra de ferramentas, a renderização por PDF.js em canvas dentro do `react-pageflip`, o zoom, a tela cheia, o download, a impressão e o compartilhamento — tudo isso está implementado, testado com PDF real e **não muda nesta versão**, exceto pela URL de onde o arquivo vem. Os três defeitos corrigidos na v2.0 (fila de desenho por canvas, opacidade travada, medição por `ResizeObserver`) continuam corrigidos e estão documentados no `DOCUMENTACAO-TECNICA.md`.

---

## 0. Princípios não-negociáveis

1. **PDF é a fonte da verdade.** O livro nunca é reprocessado em imagens estáticas no upload; a leitura renderiza o PDF original no navegador. O link de download sempre entrega exatamente o que a pessoa está lendo.
2. **Sem conta para ler.** Nenhuma barreira de login ou cadastro para o leitor. Quem publica tem conta; quem lê, nunca. Um livro publicado abre para qualquer pessoa com o link, sempre.
3. **O navegador nunca fala com o banco.** Toda leitura e escrita no Firestore e no Storage acontece em código de servidor, com credencial que não sai de lá. As regras do Firestore e do Storage negam acesso direto do cliente. Sem isso, um produto multi-tenant vaza dado entre contas — o único erro deste produto que não tem conserto.
4. **O plano gratuito publica de verdade.** Sem marca d'água, sem limite de páginas, sem expiração. O que limita é **quantidade de livros**, e só. Marca d'água no gratuito é exatamente o que torna o Heyzine gratuito inútil, e o motivo de o Alexandre pagar por ele hoje.
5. **Limite nunca tira nada do ar.** Atingir o limite impede publicar o próximo livro; não despublica, não apaga e não bloqueia a leitura de nada que já está no ar. Link que circula é o produto inteiro.
6. **Simplicidade antes de complexidade prematura.** Sem cobrança, sem times, sem papéis dentro da conta, sem white-label, sem analytics no v3. Entra quando doer.
7. **Mobile é cidadão de primeira classe.** A maior parte de quem lê chega por link do LinkedIn ou WhatsApp e abre no celular. Decisão de UX que funciona bem no desktop e mal no celular perde.

---

## 1. Visão e problema

Quem publica conteúdo em PDF — livro, zine, revista, portfólio, relatório — não tem onde colocá-lo para ser lido bem. As opções são: link direto para o arquivo (experiência ruim, ninguém lê), Issuu e Heyzine (bons, mas cobram a partir de ~US$14/mês e carimbam marca d'água no plano grátis), ou nada.

O Virapágina é a plataforma que resolve isso: sobe o PDF, escolhe o link, publica. O leitor abre no navegador, folheia com efeito de página virada, dá zoom, baixa, imprime e compartilha — sem instalar nada e sem criar conta.

O primeiro usuário é o próprio Alexandre, que hoje paga o Heyzine para publicar o livro *Conceitos de Tecnologia para Pessoas Executivas e Não Técnicas* e a revista trimestral *I See Life*.

**Anti-escopo — o que este produto não é:**

- **Não é editor de PDF nem de layout.** O PDF chega pronto, feito no Canva, no InDesign ou onde for.
- **Não é rede social.** Não há seguir, curtir, comentar ou feed.
- **Não é loja de conteúdo.** Não intermedia venda de livro, não processa pagamento de leitor, não tem paywall por título.
- **Não cobra nada de ninguém no v3.** Não há assinatura, cartão nem plano pago (ver `EPICO-COBRANCA.md`).
- **Não é ferramenta de time.** Uma conta, uma pessoa. Sem convite, sem papéis, sem organização.
- **Não é hospedagem genérica de arquivo.** Só PDF, só para leitura pública.

---

## 2. Personas e cenários de uso

**Autor (a razão de o produto existir).** Fez um zine, um portfólio, um relatório, uma revista. Chega por indicação ou busca. Precisa publicar em menos de 10 minutos, sem ler documentação. Se a primeira tela pedir mais do que o Google e um nome, ele vai embora. Para quem publica com regularidade — revista trimestral, boletim mensal —, o valor não é a próxima edição: é o acervo continuar no ar com os links antigos funcionando. É por isso que o princípio 0.5 existe.

**Leitor público.** Chega pelo link, no celular, na fila do banco. Não tem conta e não vai criar. Folheia algumas páginas, às vezes baixa o PDF, às vezes manda para alguém. Não tem paciência para esperar carregamento nem para descobrir controle escondido: os ícones precisam ser os conhecidos — seta, lupa, download, compartilhar.

**Alexandre, dono da plataforma.** Além de ser autor, precisa: entender quem está usando, liberar mais livros para quem pedir, tirar do ar um livro denunciado, e trocar um handle quando alguém errar na hora de escolher.

---

## 3. Escopo do MVP (v3.0)

### Dentro

- **Conta própria por autor**, criada com login Google, sem aprovação e sem espera.
- **Identificador público (`handle`)** escolhido no primeiro acesso, que forma a URL: `virapagina.app.br/<handle>/<slug>`.
- **Painel do autor:** listar, subir, editar, publicar, despublicar, substituir PDF e excluir os próprios livros, dentro do limite do plano.
- **Leitor público** em flipbook, responsivo, com zoom, tela cheia, download, impressão e compartilhamento. *(Já implementado na v2.0.)*
- **Vitrine do autor** em `virapagina.app.br/<handle>`.
- **Home pública** explicando o produto, com um exemplo folheável.
- **Limite de 5 livros por conta**, aplicado de verdade, com o caminho de pedir mais por contato humano.
- **Medição de tráfego por conta**, com aviso ao autor e ao dono da plataforma quando passa da franquia.
- **Administração da plataforma:** ver contas, alterar o plano de uma conta, alterar handle, remover conteúdo denunciado.
- **Termos de uso e política de privacidade**, com canal de denúncia de conteúdo.

### Fora — descartado

| O que | Por quê |
|---|---|
| Marca d'água no plano gratuito | Contraria o princípio 0.4. É exatamente o que torna o Heyzine gratuito inútil |
| Cobrança por tráfego ou por leitura | Puniria o sucesso: quanto mais lido o livro, maior a conta. Ninguém publica com medo de dar certo. O tráfego vira **válvula de segurança** (regra 11.11), não preço |
| Analytics de leitura | Custa modelagem e privacidade para responder algo que ninguém pediu ainda |
| Domínio próprio do autor (white-label) | Exige DNS e certificado por cliente. É produto diferente |
| Contas de time, convite, papéis | Princípio 0.6. Uma conta, uma pessoa |

### Fora — adiado

| O que | Onde está detalhado | O que precisa acontecer antes |
|---|---|---|
| **Cobrança inteira** — faixas, preços, Stripe, nota fiscal | **`EPICO-COBRANCA.md`**, desenhado e pronto | Contas reais publicando, e ao menos uma pessoa esbarrando no limite de 5 e pedindo mais |
| Grade de miniaturas de página | Seção 28 | Um autor pedir |
| Capa personalizada à mão | Seção 28 | Um autor querer arte diferente da primeira página |
| Atalhos fixos de compartilhamento por rede | Seção 28 | A Web Share API não bastar |
| Som de virar página | Seção 28 | — |

---

## 4. Arquitetura

### Stack

| Camada | Tecnologia | Por quê | Alternativa descartada |
|---|---|---|---|
| Frontend e servidor | **Next.js 15 (App Router), TypeScript, React 19** | Já implementado na v2.0, deploy nativo na Vercel, SSR para o SEO das páginas públicas | Vite SPA — perderia SSR das páginas de livro, que são o canal de distribuição |
| Estilo | **Tailwind CSS v4** | Já implementado; tokens do sistema visual em `@theme` | — |
| Leitura de PDF | **`pdfjs-dist` 6** em `<canvas>`, no cliente | Não exige reprocessar o PDF em imagens; o arquivo enviado é a fonte única (princípio 0.1) | Pré-gerar PNG por página no upload — multiplica armazenamento, que é justamente o custo deste produto |
| Efeito de virar página | **`react-pageflip` 2** | Já implementado e depurado com PDF real de 40 páginas | Construir do zero |
| Dados | **Cloud Firestore**, acessado só pelo **Admin SDK** no servidor | Sem custo fixo mensal: a franquia permanente cobre o volume inicial inteiro. Escala por documento, que é a forma do dado aqui | Postgres/Supabase (v1.0) — descartado pelo custo fixo. Google Sheets (v2.0) — não suporta multi-tenant: sem transação, sem unicidade, e a cota da API vira gargalo com muitos autores |
| Arquivos | **Cloud Storage for Firebase**, um caminho por conta | Mesmo projeto, mesma credencial, mesma console dos dados | Google Drive (v2.0) — a conta de serviço não tem cota própria e o modelo de compartilhamento não é multi-tenant |
| Login | **Auth.js v5 com Google** | Já implementado na v2.0; só muda de allowlist para autocadastro | Firebase Auth — obrigaria a reescrever a autenticação que já funciona e a duplicar a sessão entre dois sistemas |
| Tarefas periódicas | **Vercel Cron** | Sem infraestrutura nova; a rotina da seção 13.4 é uma chamada HTTP | Cloud Scheduler — outro console para manter |
| Deploy | **Vercel**, branch `main` = produção, domínio `virapagina.app.br` | Padrão do Alexandre | — |

### O que roda onde

- **Renderização das páginas** acontece no navegador do leitor, sempre (princípio 0.1). O servidor nunca converte PDF em imagem.
- **Toda leitura e escrita no Firestore e no Storage** acontece em rota de servidor ou componente de servidor, com o Admin SDK (princípio 0.3). As regras do Firestore e do Storage **negam todo acesso direto do cliente** — não são a camada de autorização, são a tranca que garante que a única porta é a nossa.
- **Upload do PDF:** a rota de servidor gera uma **URL assinada de upload resumável**; o navegador envia os bytes direto para o Google. Os bytes não passam pela Vercel, cujo limite de corpo de requisição (~4,5 MB) tornaria a regra 11.2 impossível. A credencial nunca vai ao navegador.
- **Leitura do PDF e da capa pelo público:** o navegador pede à rota de proxy, que lê do Storage e transmite. O leitor nunca recebe uma URL do Storage — é o que permite tirar um livro do ar de verdade, o que impede um link vazado de sobreviver ao despublicar, e o que torna possível medir o tráfego por conta (regra 11.11).

### Premissas técnicas a validar

| # | Premissa | Como validar | Se falhar |
|---|---|---|---|
| 4.1 | O PDF.js renderiza no celular um PDF de ~40 páginas e ~9 MB sem travar | **Já validado** na v2.0 no desktop; falta o teste em iPhone e Android reais (seção 22) | Pré-renderizar páginas em imagem no upload, revendo o princípio 0.1 |
| 4.2 | A conta do Firebase precisa do plano **Blaze** para usar o Storage, mas a franquia permanente (5 GB armazenados e 100 GB de saída por mês) mantém a fatura em zero no volume inicial | Criar o projeto e conferir a franquia no console antes do primeiro upload | Não há alternativa dentro do Firebase; a fuga é trocar o Storage por um fornecedor sem cobrança de saída, mudança contida em `lib/firebase/storage.ts` |
| 4.3 | O Blaze **não tem teto de gasto**, só alerta de orçamento | Configurar alerta de orçamento antes do lançamento | A regra 11.11 (válvula de tráfego) é a mitigação de produto |

---

## 5. Perfis de usuário e matriz de permissões

Três perfis. Note que **admin da plataforma é papel de plataforma, não de conta** — ele não é "o dono de uma conta maior".

| Ação | Visitante | Autor | Admin da plataforma |
|---|---|---|---|
| Ler livro publicado | ✅ | ✅ | ✅ |
| Ler livro em rascunho | ❌ | ✅ **só os próprios** | ❌ (ver nota) |
| Ver vitrine de um autor | ✅ (só publicados) | ✅ | ✅ |
| Baixar PDF de livro publicado | ✅ | ✅ | ✅ |
| Criar conta | ✅ (vira Autor) | — | — |
| Escolher o `handle` | ❌ | ✅ **uma vez, no primeiro acesso** | ✅ pode alterar o de qualquer conta |
| Subir livro | ❌ | ✅ **até o limite do plano** | ❌ |
| Editar, publicar, despublicar, excluir livro | ❌ | ✅ **só os próprios** | ❌ |
| Ver dados de outra conta | ❌ | ❌ | ✅ (e-mail, handle, plano, uso, tráfego) |
| Alterar o plano de uma conta | ❌ | ❌ | ✅ |
| Remover livro por denúncia | ❌ | ❌ | ✅ **despublica; não exclui** |

**Nota sobre rascunho.** O admin da plataforma **não** enxerga rascunho de terceiros. Rascunho é material não publicado de outra pessoa; dar acesso a isso por conveniência de suporte é o começo do vazamento entre contas. Se precisar agir sobre um livro denunciado, ele age sobre um livro **publicado** — que é justamente o que a denúncia alcança.

**Primeiro admin da plataforma (seed).** Não existe autocadastro nem promoção pela interface. A lista vive na variável de ambiente `ADMIN_ALLOWED_EMAILS` (e-mails separados por vírgula). Adicionar um admin é editar essa variável na Vercel e refazer o deploy. É deliberadamente pouco prático: a operação é rara e o custo do erro é alto.

**Escopo de dados.** Todo livro pertence a exatamente uma conta, pelo campo `dono_id`. Não existe livro sem dono. Toda rota que lê ou escreve um livro confere `dono_id` contra a sessão antes de agir — é essa comparação, e não a URL, que define o que a pessoa alcança.

---

## 6. Autenticação e identidade

- **Identificação:** login com Google (OAuth 2.0) via Auth.js v5. Não existe usuário e senha próprios. Recuperação de senha não se aplica — é o fluxo do Google.
- **Criação de conta:** automática no primeiro login. Não há aprovação, lista de espera nem convite. Quem entra vira Autor no plano gratuito.
- **Primeiro acesso:** depois do primeiro login, a pessoa é levada a **escolher o `handle`** antes de qualquer outra tela. Sem `handle` não existe URL pública, logo não existe produto. A tela não é pulável.
- **Sessão:** cookie JWT do Auth.js, 30 dias, renovação silenciosa. Não há banco de sessão. Logout limpa o cookie e volta para a home pública.
- **Identificador interno:** o `id` do documento em `usuarios` é o `sub` do Google (estável e único). O e-mail é espelhado para exibição e suporte, mas **nunca é chave** — e-mail do Google pode mudar.

### Autorização — as três guardas

Substituem o RLS que existiria num banco relacional. Toda rota chama a sua guarda **como primeira linha**, antes de qualquer leitura ou escrita.

| Guarda | Onde se aplica | O que faz |
|---|---|---|
| `requireAutor()` | `/api/conta/*` | Sem sessão, `401`. Com sessão, devolve o documento da conta (criando-o no primeiro acesso). Se a conta ainda não tem `handle`, devolve `409` com o destino da tela de escolha. |
| `requireDonoDoLivro(id)` | Toda rota que toca um livro específico | Roda a guarda acima e depois compara `livro.dono_id` com a sessão. Diferente, `404` — **não `403`**: responder "existe, mas não é seu" confirma a existência de um rascunho alheio. |
| `requireAdminPlataforma()` | `/api/admin/*` | Sem sessão, `401`. E-mail fora de `ADMIN_ALLOWED_EMAILS`, `403`. |

E a irmã sem erro, `sessaoAtual()`, usada pelas rotas públicas para decidir se mostram o rascunho do próprio dono.

### As trancas do Firestore e do Storage

As regras de segurança negam **toda** operação vinda do cliente:

```
// firestore.rules
match /{document=**} { allow read, write: if false; }

// storage.rules
match /{allPaths=**} { allow read, write: if false; }
```

O Admin SDK passa por cima das regras por definição, então a aplicação continua funcionando. Isso não é a camada de autorização — as guardas acima são. É a garantia de que **não existe segunda porta**: mesmo que uma chave pública do Firebase vaze, ela não abre nada.

---

## 7. Modelo de dados

O Firestore é documental, não relacional. Mesmo assim as convenções valem: **nomes de coleção e de campo em português, `snake_case`**, e a fronteira de idioma na camada de acesso a dados.

```
usuarios 1 ────< livros (dono_id)
usuarios 1 ──── 1 handles (reserva do nome público)
usuarios 1 ────< acoes_admin (conta_alvo)
```

Os campos que a cobrança acrescenta a `usuarios`, e a coleção `eventos_stripe`, estão especificados na seção 2 do `EPICO-COBRANCA.md`. **Não implementar agora.**

### Coleção `usuarios`

Id do documento: o `sub` do Google.

| Campo | Tipo | Nulo? | Default | Descrição |
|---|---|---|---|---|
| `email` | string | não | — | Espelho do Google, para exibição e suporte. Nunca é chave |
| `nome` | string | sim | — | Nome do Google. Nulo se a conta não expõe |
| `handle` | string | sim | — | Identificador público na URL. **Nulo até o primeiro acesso concluir a escolha** — é o único estado em que a conta existe sem URL pública |
| `plano` | `plano` | não | `gratuito` | Define o limite de livros (regra 11.8). No v3 muda por ação do admin da plataforma, **ou automaticamente para `ilimitado`** quando o e-mail está em `ADMIN_ALLOWED_EMAILS` (regra 11.13) |
| `trafego_mes_bytes` | number | não | `0` | Bytes servidos no mês corrente. Alimenta a válvula da regra 11.11 |
| `trafego_mes_referencia` | string | não | mês atual | `AAAA-MM`. Quando não bate com o mês de hoje, o contador zera |
| `criado_em` | timestamp | não | agora | — |
| `atualizado_em` | timestamp | não | agora | Reescrito pela aplicação em toda gravação. **Não existe trigger** |

### Coleção `handles`

Id do documento: o próprio handle em minúsculas.

| Campo | Tipo | Nulo? | Descrição |
|---|---|---|---|
| `usuario_id` | string | não | Dono do handle. Vazio nos reservados de seed |
| `criado_em` | timestamp | não | — |

**Por que uma coleção só para isso.** O Firestore não tem índice único. Sem esta coleção, dois cadastros simultâneos escolhem o mesmo handle e ambos vencem. A criação do handle é feita numa **transação** que grava o documento aqui com `create` (falha se já existir) e o campo `handle` em `usuarios` — atômico, portanto seguro.

**Handles reservados**, gravados como seed com `usuario_id` vazio: `admin`, `api`, `app`, `ajuda`, `blog`, `conta`, `contato`, `entrar`, `favicon.ico`, `l`, `login`, `precos`, `privacidade`, `sair`, `sobre`, `suporte`, `termos`, `www`, `_next`.

*(`precos` fica reservado desde já, mesmo sem existir a tela, para o dia em que a cobrança entrar.)*

### Coleção `livros`

Id do documento: UUID gerado pela aplicação.

| Campo | Tipo | Nulo? | Default | Descrição |
|---|---|---|---|---|
| `dono_id` | string | não | — | Id em `usuarios`. Todo livro tem dono |
| `titulo` | string | não | — | Título de exibição |
| `subtitulo` | string | sim | — | Nulo quando não há |
| `slug` | string | não | — | Identificador na URL. Só `^[a-z0-9-]+$`. **Único por dono**, não globalmente |
| `autor` | string | não | nome ou e-mail da conta | Nome exibido. Editável, porque nem sempre o autor do livro é o dono da conta |
| `descricao` | string | sim | — | Vitrine e meta tag de compartilhamento |
| `arquivo_pdf_caminho` | string | não | — | `livros/<dono_id>/<livro_id>/original.pdf` no Storage |
| `arquivo_pdf_tamanho_bytes` | number | sim | — | Nulo só se a leitura falhar. Não bloqueia publicar |
| `capa_caminho` | string | sim | — | `livros/<dono_id>/<livro_id>/capa.png`. Nulo até ser gerada |
| `total_paginas` | number | sim | — | Nulo só se a extração falhar |
| `publicado` | boolean | não | `false` | Firestore tem boolean nativo confiável — some a string `"sim"`/`"nao"` que a planilha da v2.0 exigia |
| `removido_por_denuncia` | boolean | não | `false` | Despublicado por admin da plataforma. O dono vê o motivo e **não consegue republicar** |
| `criado_em` | timestamp | não | agora | Ordena a vitrine |
| `atualizado_em` | timestamp | não | agora | Reescrito pela aplicação em toda gravação |

**Índices compostos necessários:** `(dono_id, criado_em desc)` para o painel e a vitrine; `(dono_id, slug)` para a checagem de unicidade; `(publicado, criado_em desc)` para o exemplo da home.

**Unicidade de slug é responsabilidade do código.** Como em `handles`, o Firestore não impõe. A criação e a edição leem os livros do dono e recusam duplicata antes de gravar.

### Coleção `acoes_admin`

| Campo | Tipo | Nulo? | Descrição |
|---|---|---|---|
| `admin_email` | string | não | Quem fez |
| `acao` | `acao_admin` | não | O que fez |
| `conta_alvo` | string | sim | Sobre qual conta |
| `livro_alvo` | string | sim | Sobre qual livro, quando aplicável |
| `detalhe` | map | sim | O antes e o depois |
| `feito_em` | timestamp | não | — |

Vale para o Alexandre também. Auditoria com exceção para o dono não é auditoria.

### Enums

| Enum | Valores | Significado |
|---|---|---|
| `plano` | `gratuito`, `ate_20`, `ate_50`, `ate_100`, `ilimitado` | Faixa de limite de livros (regra 11.8). As faixas intermediárias já existem no v3 porque o admin as concede à mão; o que falta é só o caminho de pagar por elas. `ilimitado` é o plano das contas do próprio dono (regra 11.13) — sem limite, sem franquia e fora de qualquer cobrança |
| `acao_admin` | `alterou_plano`, `alterou_handle`, `removeu_livro`, `consultou_conta` | — |

### Estratégia de exclusão

| Entidade | Estratégia | Por quê |
|---|---|---|
| `livros` | **Hard delete**, com os arquivos do Storage apagados **depois** da exclusão do documento | Não há histórico a preservar, e arquivo órfão no Storage é custo puro. A ordem importa: nunca sobra metadado apontando para arquivo inexistente |
| `usuarios` | **Hard delete, mas sem botão.** Apagar a conta é pedido por e-mail, atendido **em até 30 dias** direto no console do Firebase (decisão 25.2). Saem juntos: a conta, o handle, todos os livros e todos os arquivos | Apagar conta apaga livros, que apaga links que circulam — merece conversa humana e um par de olhos. Uma rota "exclua qualquer conta" seria a mais perigosa do sistema para atender um caso que acontece uma vez por ano |
| `handles` | Sai junto com a conta | Enquanto a conta existe, handle liberado é link sequestrado: quem pegasse o nome herdaria o tráfego dos links antigos. Quando a conta some, o nome volta a ficar livre |

### Dados de seed

Só os handles reservados. Nenhuma conta, nenhum livro. A conta do Alexandre nasce como qualquer outra, no primeiro login — e recebe `plano = ate_100` pela tela de admin.

---

## 8. Épicos e critérios de aceite

Ordem de implementação. Os épicos 8.3 e 8.4 estão **implementados desde a v2.0** e entram aqui só com o que muda.

### 8.1 Conta, identidade e handle

**Objetivo:** qualquer pessoa entra com o Google, escolhe seu identificador público e chega ao painel.

**Fluxo:** `/entrar` → "Entrar com Google" → primeiro login cria a conta no plano gratuito → tela de escolha do handle → `/conta/livros`.

**Critérios de aceite:**

- Qualquer conta Google consegue entrar. Não existe allowlist para autores.
- No primeiro login, o documento em `usuarios` é criado com `plano = gratuito` e `handle` nulo.
- **E-mail presente em `ADMIN_ALLOWED_EMAILS` nasce com `plano = ilimitado`**, sem passo manual nenhum. Se o e-mail for acrescentado à variável depois, o próximo login da conta corrige o plano sozinho (regra 11.13).
- Enquanto o `handle` for nulo, qualquer rota `/conta/*` redireciona para a tela de escolha; ela não é pulável.
- A tela sugere um handle a partir do nome ou do e-mail do Google, e o campo é editável.
- Handle inválido (fora de `^[a-z0-9-]{3,30}$`) é recusado com "Use de 3 a 30 letras minúsculas, números ou hífen."
- Handle já em uso ou reservado é recusado com "Esse endereço já está em uso, escolha outro." e uma sugestão livre.
- Dois cadastros simultâneos com o mesmo handle: **um vence e o outro recebe a mensagem de já em uso.** Nunca os dois.
- Concluída a escolha, `virapagina.app.br/<handle>` responde com a vitrine, mesmo vazia.
- O handle **não pode ser alterado** pelo próprio autor no v3. A tela explica que a troca é feita pelo suporte.
- "Sair" encerra a sessão e volta para a home pública.
- Nenhuma rota sob `/api/conta/*` lê ou escreve no Firestore ou no Storage antes de `requireAutor()`, e nenhuma rota que toca um livro age antes de `requireDonoDoLivro()`.

### 8.2 Painel do autor — livros

**Objetivo:** o autor sobe, edita, publica, despublica, substitui e exclui os próprios livros, respeitando o limite do plano.

**Fluxo (livro novo):** `/conta/livros` → "Novo livro" → formulário (título, subtítulo, slug sugerido e editável, autor, descrição, PDF) → o navegador lê o PDF, extrai o total de páginas e desenha a capa → o arquivo sobe direto para o Storage com barra de progresso → a linha é gravada como rascunho → o autor confere na prévia e publica.

**Critérios de aceite:**

- A lista mostra **só os livros do próprio dono**, com miniatura, título, endereço, selo "Publicado"/"Rascunho", data de atualização e link "Ver página pública" (só quando publicado).
- Pedir `/conta/livros/<id>` de um livro de outra conta devolve **404**, não 403.
- Estado vazio: "Nenhum livro ainda." com "Novo livro" em destaque.
- O cabeçalho da lista mostra o uso contra o limite: "3 de 5 livros".
- **Atingido o limite do plano**, o botão "Novo livro" fica desabilitado e a tela mostra "Você chegou ao limite de {n} livros." com o botão "Falar com a gente", que abre um e-mail para o endereço de contato. Excluir um livro libera a vaga imediatamente.
- Arquivo que não é PDF é recusado no navegador com "Envie um arquivo PDF."
- Arquivo acima de 100 MB é recusado antes de subir com "Arquivo muito grande (máximo 100 MB)."
- A barra de progresso reflete o progresso real do envio, não uma animação.
- Slug duplicado **dentro da mesma conta** é recusado no servidor com "Esse link já está em uso, escolha outro." e a sugestão `-2`, `-3`…
- Slug igual ao de **outra conta** é aceito sem reclamação — o namespace é por autor.
- Editar metadados não exige reenviar o PDF. Trocar de arquivo é a ação separada "Substituir PDF", que recalcula páginas e tamanho e regenera a capa.
- Alterar o slug de um livro publicado exige confirmação: "Isso muda o link público. Quem tinha o link antigo vai receber página não encontrada. Continuar?"
- "Despublicar" tira da vitrine e faz a URL pública devolver 404, sem apagar nada.
- "Excluir" pede confirmação nomeando o livro e remove o documento e depois os arquivos.
- Livro despublicado por denúncia mostra o aviso no painel e o botão "Publicar" fica desabilitado.
- Se o upload falhar no meio, a tela mostra "Não foi possível concluir o envio. Tente novamente.", **mantém os campos preenchidos** e nenhum documento é criado.

### 8.3 Leitor público — o que muda

Implementado na v2.0. Nesta versão muda **só o endereço** e a origem do arquivo.

**Critérios de aceite (novos ou alterados):**

- A URL passa a ser `/<handle>/<slug>`; `/l/<slug>` deixa de existir.
- Handle inexistente, slug inexistente, ou livro em rascunho pedido por quem não é o dono: página 404 com "Esse livro não está disponível." e link para a home.
- O dono logado enxerga o próprio rascunho nessa URL — é a prévia da seção 9.
- O PDF e a capa vêm das rotas de proxy sobre o Storage. **Nenhuma URL do Storage chega ao navegador.**
- Cada byte servido é somado ao contador de tráfego da conta do dono (regra 11.11).
- Tudo o mais (página dupla acima de 1024px, clique e arrasto na borda, setas, swipe, indicador "12 de 44", esqueleto de carregamento) continua valendo como está implementado.

### 8.4 Ações do leitor — o que muda

Implementado na v2.0. **Nada muda** além do caminho das rotas de download e impressão, que passam a incluir o handle. Zoom de 75% a 250% em passos de 25%, tela cheia oculta onde não há suporte, download com o título como nome do arquivo, impressão em nova aba, compartilhamento por Web Share API com cópia do link como alternativa, e `aria-label` em todos os botões — tudo permanece.

### 8.5 Vitrine do autor

**Objetivo:** quem chega em `/<handle>` encontra os livros publicados daquela pessoa.

**Critérios de aceite:**

- `/<handle>` lista os livros com `publicado = true` **daquele dono**, do mais recente para o mais antigo, com capa, título, subtítulo e autor.
- Rascunho não aparece — nem para o próprio dono. A vitrine é a página pública; conferir rascunho é papel da prévia.
- Clicar num item leva para `/<handle>/<slug>`.
- Handle inexistente devolve 404 com "Esse endereço não existe." e link para a home.
- Vitrine sem nenhum livro publicado mostra "Nenhum livro publicado ainda.", sem tom de erro.
- A página não expõe o e-mail do autor.

### 8.6 Home

**Objetivo:** quem chega em `virapagina.app.br` entende o que é em menos de dez segundos.

**Critérios de aceite:**

- `/` mostra o que o produto faz, um exemplo real folheável e o botão "Começar de graça".
- A página deixa explícito que **não há marca d'água** e que **o leitor não precisa de conta**.
- A home **não** menciona preço nem plano pago — eles não existem no v3.
- A home não lista livros de ninguém sem consentimento: só o exemplo escolhido pelo dono da plataforma, definido por variável de ambiente.
- Visitante deslogado que clica em "Começar de graça" vai para o login.
- `/termos` e `/privacidade` nomeiam o responsável (**DabLab, CNPJ 61.033.268/0001-14**), trazem `alexandre@dablab.com.br` como contato e canal de denúncia, e dizem explicitamente que a exclusão de conta é atendida em até 30 dias e **faz os links publicados pararem de funcionar** (decisões 25.2 a 25.4).

### 8.7 Administração da plataforma

**Objetivo:** o dono da plataforma resolve os quatro casos que só ele resolve.

**Critérios de aceite:**

- `/admin` só abre para e-mail em `ADMIN_ALLOWED_EMAILS`; qualquer outro recebe 404 — **não uma tela de acesso negado**, que confirmaria que a rota existe.
- A lista de contas mostra e-mail, handle, plano, quantidade de livros e tráfego do mês contra a franquia. **Não mostra rascunho de ninguém.**
- Conta acima de 80% da franquia de tráfego aparece destacada.
- Alterar o plano de uma conta funciona em um clique e grava em `acoes_admin`. É assim que alguém que pediu mais livros é atendido no v3.
- Tentar alterar o plano de uma conta cujo e-mail está em `ADMIN_ALLOWED_EMAILS` é recusado: ela é `ilimitado` por definição (regra 11.13), e o próximo login desfaria a mudança de qualquer jeito.
- Alterar o handle de uma conta é feito numa transação que libera o antigo e reserva o novo.
- "Remover livro" despublica um livro **publicado**, marca `removido_por_denuncia` e grava a ação. Não exclui o arquivo — remoção indevida precisa ser reversível.
- Toda ação de admin, inclusive consulta a uma conta, grava em `acoes_admin`.

---

## 9. Fluxos principais ponta a ponta

### Da chegada ao primeiro livro publicado

1. A pessoa chega em `virapagina.app.br` por indicação ou busca.
2. Clica em "Começar de graça" e entra com o Google. A conta nasce no plano gratuito.
3. Escolhe o handle. A URL pública passa a existir.
4. Em `/conta/livros`, clica "Novo livro", preenche o título e escolhe o PDF.
5. O navegador lê o arquivo, extrai o total de páginas e desenha a capa; o PDF sobe direto para o Storage com progresso real.
6. O livro é gravado como rascunho. A pessoa é levada à tela de edição, com a prévia.
7. Confere folheando o próprio livro e clica "Publicar".
8. `virapagina.app.br/<handle>/<slug>` passa a responder para qualquer pessoa, e o livro aparece na vitrine.

### Do sexto livro

1. Com 5 livros, "Novo livro" fica desabilitado e a tela mostra o limite com o botão "Falar com a gente".
2. A pessoa escreve. O Alexandre, na tela de admin, altera o plano da conta dela para a faixa que fizer sentido.
3. O limite novo vale na hora. **Nada precisou sair do ar em momento nenhum.**

Quando a cobrança entrar (`EPICO-COBRANCA.md`), esse passo 2 vira um Checkout — e só ele muda.

### Caminho de exceção — o Firestore ou o Storage falham

Qualquer rota que não conseguir falar com o Google devolve ao usuário "Algo deu errado. Tente novamente em instantes." e registra o erro real no log de servidor. Detalhe técnico da API nunca aparece na tela. **Vitrine vazia e falha de integração são estados diferentes, com mensagens diferentes** — a mensagem errada manda o dono procurar o problema no lugar errado.

### Caminho de exceção — a conta passa da franquia de tráfego

1. A rotina diária detecta que a conta passou de 80% da franquia e avisa o autor por e-mail.
2. Passando de 100%, avisa o dono da plataforma.
3. **Nada é cortado, nada é cobrado, nenhum livro sai do ar.** O aviso existe para gerar conversa, não punição (regra 11.11).

---

## 10. Inventário de telas

| Tela | Perfil | O que mostra | Lê | Escreve |
|---|---|---|---|---|
| `/` — Home | Todos | O que é o produto, exemplo folheável, "Começar de graça" | `livros` (o exemplo) | — |
| `/termos`, `/privacidade` | Todos | Termos de uso e política de privacidade, com canal de denúncia | — | — |
| `/entrar` — Login | Visitante | Botão único "Entrar com Google" | — | — |
| `/conta/handle` — Escolher endereço | Autor sem handle | Campo com sugestão, validação e disponibilidade | `handles` | `handles`, `usuarios` |
| `/<handle>` — Vitrine | Todos | Grade dos livros publicados daquele autor | `usuarios`, `livros` | — |
| `/<handle>/<slug>` — Leitor | Todos | Flipbook, título/autor, barra de ferramentas | `usuarios`, `livros`, Storage | `usuarios` (contador de tráfego) |
| `/conta/livros` — Meus livros | Autor | Lista dos próprios livros, uso contra o limite | `usuarios`, `livros` | — |
| `/conta/livros/novo` — Novo livro | Autor | Formulário e upload | `livros` (slug) | `livros`, Storage |
| `/conta/livros/[id]` — Editar | Autor dono | Formulário, prévia, publicar/despublicar, substituir, excluir | `livros` | `livros`, Storage |
| `/admin` — Contas | Admin plataforma | Lista de contas com plano, uso e tráfego | `usuarios`, `livros` | `acoes_admin` |
| `/admin/contas/[id]` — Conta | Admin plataforma | Detalhe, alterar plano, alterar handle, remover livro | `usuarios`, `livros` | `usuarios`, `livros`, `acoes_admin` |

---

## 11. Regras de negócio

| # | Regra | Onde se aplica |
|---|---|---|
| 11.1 | A capa é gerada renderizando a primeira página do PDF em canvas, no navegador, no momento do upload, e enviada como PNG. Não há upload manual de capa | Frontend do autor + rota |
| 11.2 | Tamanho máximo do PDF: **100 MB**. Acima disso o envio é recusado antes de começar, e a rota que abre a sessão de upload recusa de novo | Frontend + servidor |
| 11.3 | O slug é sugerido a partir do título (minúsculo, sem acento, kebab-case) e é sempre editável. É **único por dono**, nunca globalmente | Frontend + servidor |
| 11.4 | Um livro só aparece na vitrine e responde na URL pública quando `publicado = true`. Não existe estado intermediário | Servidor + frontend |
| 11.5 | O zoom do leitor vai de **75% a 250%**, em passos de **25%**, começando em **100%** | Frontend do leitor |
| 11.6 | Excluir um livro remove o documento e **depois** os arquivos do Storage, nessa ordem, para nunca sobrar metadado apontando para arquivo inexistente | Rota de exclusão |
| 11.7 | Toda leitura que alimenta tela pública (home, vitrine, leitor) é cacheada por no mínimo **60 segundos**. Ação do autor invalida o cache dele imediatamente | Servidor |
| 11.8 | **Limite de livros por plano.** O limite conta **todos** os livros da conta, rascunho e publicado, porque o custo é o arquivo guardado, não a visibilidade | Servidor |
| 11.9 | **Nada de mudar de plano tira coisa do ar.** Baixar o plano de uma conta que está acima do novo limite não exclui, não despublica e não bloqueia leitura de nada: só impede publicar o próximo | Servidor |
| 11.10 | O `handle` é escolhido uma vez e **não é alterável pelo autor** no v3. Handle liberado herda o tráfego dos links antigos, o que é sequestro de audiência | Frontend + servidor |
| 11.11 | **Válvula de tráfego.** Cada plano tem franquia mensal de saída de dados. Passar dela **não corta nada e não gera cobrança**: gera aviso ao autor em 80% e ao dono da plataforma em 100%, para conversa. Conta `ilimitado` não tem franquia e nunca dispara aviso | Proxy de arquivo + rotina diária |
| 11.12 | Livro com `removido_por_denuncia = true` não pode ser republicado pelo dono. Só o admin da plataforma reverte | Servidor |
| 11.13 | **As contas do dono da plataforma são ilimitadas.** Todo e-mail presente em `ADMIN_ALLOWED_EMAILS` recebe `plano = ilimitado` no primeiro login e a cada login seguinte: sem limite de livros, sem franquia de tráfego, e fora de qualquer cobrança quando ela existir. Não é ação manual e não pode ser desfeita pela tela | Servidor, no login |

### 11.8 — Limites por plano

| Plano | Limite de livros | Franquia de tráfego (regra 11.11) | Como se chega nele no v3 |
|---|---|---|---|
| `gratuito` | 5 | 20 GB | Padrão de toda conta nova |
| `ate_20` | 20 | 50 GB | Concedido à mão pelo admin da plataforma |
| `ate_50` | 50 | 100 GB | Concedido à mão pelo admin da plataforma |
| `ate_100` | 100 | 200 GB | Concedido à mão pelo admin da plataforma |
| `ilimitado` | **sem limite** | **sem franquia** | **Automático** para todo e-mail em `ADMIN_ALLOWED_EMAILS` (regra 11.13) |

Os preços de cada faixa estão em `EPICO-COBRANCA.md` e **não valem no v3** — aqui as faixas existem, mas não há como comprá-las. Os valores de franquia de tráfego são **assunção declarada** (24.5) e precisam de revisão do Alexandre.

---

## 12. Máquinas de estado

### Livro

```
[criado] → publicado = false (rascunho)
    │
    │ autor clica "Publicar"          ┌──────────────────────────────┐
    ▼                                 │ admin remove por denúncia    │
publicado = true ────────────────────►│ publicado = false            │
    │        ▲                        │ removido_por_denuncia = true │
    │        │ autor clica "Publicar" └──────────────────────────────┘
    │ autor  │                                     │
    │ clica  │                                     │ só o admin reverte
    ▼ "Despublicar"                                ▼
publicado = false ◄───────────────────── (bloqueado para o dono)
```

Não existe "arquivado" nem "agendado".

### Plano da conta

No v3 o plano só muda por ação do admin da plataforma, em qualquer direção, e **nenhuma transição mexe em livro** (regra 11.9). A máquina de estado da assinatura, com os quatro estados espelhados do Stripe, está na seção 2 do `EPICO-COBRANCA.md`.

---

## 13. Contratos de API

Toda rota devolve erro genérico ao usuário e registra o detalhe técnico no log (seção 9).

### 13.1 Públicas

| Rota | O que faz | O que valida antes de agir |
|---|---|---|
| `GET /api/autores/[handle]` | Vitrine: dados públicos do autor e livros publicados | Handle existe? Senão 404. Nunca devolve e-mail |
| `GET /api/livros/[handle]/[slug]` | Metadados de um livro | Handle e slug existem? Publicado — ou quem pede é o dono? Senão 404. Prévia do dono nunca vem do cache |
| `GET /api/livros/[handle]/[slug]/pdf` | Transmite o PDF do Storage | Mesma visibilidade. `?download=1` acrescenta `Content-Disposition` com o título. Soma os bytes servidos em `trafego_mes_bytes` (regra 11.11). Rascunho recebe `Cache-Control: private, no-store` |
| `GET /api/livros/[handle]/[slug]/capa` | Transmite a capa | Mesma visibilidade; 404 se não há capa |

### 13.2 Do autor — todas chamam `requireAutor()` na primeira linha

| Rota | O que valida |
|---|---|
| `POST /api/conta/handle` | Formato `^[a-z0-9-]{3,30}$`; não reservado; livre. Grava em **transação** com `handles` |
| `GET /api/conta/livros/slug-disponivel` | Slug em formato válido; livre **dentro da conta** |
| `POST /api/conta/livros/sessao-upload` | Tipo é `application/pdf`; tamanho ≤ 100 MB; **a conta ainda tem vaga no plano** (regra 11.8) |
| `POST /api/conta/livros` | Título; arquivo já enviado; slug válido e livre na conta; vaga no plano. Grava como rascunho |
| `PUT /api/conta/livros/[id]` | `requireDonoDoLivro`; título; slug válido e livre na conta ignorando o próprio |
| `DELETE /api/conta/livros/[id]` | `requireDonoDoLivro`. Apaga o documento e **depois** os arquivos |
| `POST /api/conta/livros/[id]/publicar` | `requireDonoDoLivro`; **`removido_por_denuncia` é falso** (regra 11.12) |
| `POST /api/conta/livros/[id]/despublicar` | `requireDonoDoLivro` |
| `POST /api/conta/livros/[id]/substituir-pdf` | `requireDonoDoLivro`. Recalcula páginas e tamanho, regenera a capa, apaga os arquivos antigos depois |

### 13.3 Admin da plataforma — todas chamam `requireAdminPlataforma()`

| Rota | O que faz |
|---|---|
| `GET /api/admin/contas` | Lista contas com plano, uso e tráfego. **Nunca devolve rascunho** |
| `POST /api/admin/contas/[id]/plano` | Altera a faixa da conta; grava em `acoes_admin`. **Não toca em livro nenhum** (regra 11.9) |
| `POST /api/admin/contas/[id]/handle` | Altera o handle numa transação que libera o antigo e reserva o novo |
| `POST /api/admin/livros/[id]/remover` | Despublica e marca `removido_por_denuncia`; grava em `acoes_admin` |

### 13.4 Rotina periódica (Vercel Cron, protegida por `CRON_SECRET`)

| Rota | Quando | O que faz |
|---|---|---|
| `POST /api/rotinas/avisar-trafego` | diária | Avisa o autor que passou de 80% da franquia e o dono da plataforma acima de 100% (regra 11.11). **Aviso, não corte** |

As rotinas de reconciliação de assinatura e de rebaixamento entram com a cobrança (seção 4 do `EPICO-COBRANCA.md`).

---

## 14. Exportação

Não há exportação de dados no v3.

O autor pode baixar seus próprios PDFs a qualquer momento pela URL pública do próprio livro: os arquivos que ele subiu nunca ficam reféns da plataforma.

---

## 15. Copy

Conteúdo final, não placeholder.

| Contexto | Texto |
|---|---|
| Vitrine sem livros | "Nenhum livro publicado ainda." |
| Lista do autor vazia | "Nenhum livro ainda." (botão: "Novo livro") |
| Limite atingido | "Você chegou ao limite de {n} livros." (botão: "Falar com a gente") |
| Handle em formato inválido | "Use de 3 a 30 letras minúsculas, números ou hífen." |
| Handle indisponível | "Esse endereço já está em uso, escolha outro." |
| Handle é definitivo | "O endereço não pode ser alterado depois. Para trocar, fale com o suporte." |
| Slug duplicado | "Esse link já está em uso, escolha outro." |
| Upload não-PDF | "Envie um arquivo PDF." |
| Upload grande demais | "Arquivo muito grande (máximo 100 MB)." |
| Confirmação de exclusão | "Excluir "{título}"? Essa ação não pode ser desfeita." |
| Aviso de troca de slug | "Isso muda o link público. Quem tinha o link antigo vai receber página não encontrada. Continuar?" |
| Link copiado | "Link copiado." |
| Livro indisponível (404) | "Esse livro não está disponível." |
| Autor inexistente (404) | "Esse endereço não existe." |
| Erro de upload | "Não foi possível concluir o envio. Tente novamente." |
| Erro genérico de integração | "Algo deu errado. Tente novamente em instantes." |
| Livro removido por denúncia | "Este livro foi despublicado por violar os termos de uso. Fale com o suporte." |
| Aviso de tráfego ao autor | "Seus livros foram muito lidos este mês — você já usou 80% da franquia de tráfego. Vamos conversar antes que isso vire um problema." |

---

## 16. Direção visual

Mantida da v2.0 e já implementada, a partir do canvas `Vira Pagina design/Virapagina.dc.html`:

- **Paleta neutra** (cinza, branco, quase-preto) com **um único tom de destaque**, o azul `#1C5FD8` (`#12439B` no hover). Vermelho `#A32020` reservado para perigo e alerta, verde `#1A7F4B` para o selo "Publicado" — **cor semântica não se mistura com cor de marca**.
- **Tipografia:** Instrument Sans na interface, Instrument Serif nos títulos grandes das páginas públicas.
- **Forma:** cantos arredondados suaves, hairlines em vez de bordas pesadas, espaçamento generoso.
- **Painel do autor e admin da plataforma:** menu lateral estilo App Store Connect — grupos em negrito escuro sem maiúsculas decorativas, itens indentados sem marcador, hairline entre grupos, um item ativo por vez na cor de destaque com pílula clara ao fundo, rodapé com o e-mail e "Sair".
- **Páginas públicas** (home, vitrine, leitor, termos) **não** usam menu lateral. São páginas consumer com cabeçalho simples; o leitor usa barra de ferramentas flutuante sobre fundo escuro.

Livre para o agente: a ilustração da home.

---

## 17. Requisitos não-funcionais

- **Performance:** primeira página do livro visível em até 3s em 4G comum, para PDF de até 50 páginas / 15 MB.
- **Tamanho de arquivo:** até 100 MB (regra 11.2).
- **Responsivo:** de 360px a 2560px. Página única abaixo de 1024px.
- **Navegadores:** últimas 2 versões de Chrome, Safari (incluindo iOS), Firefox e Edge. Onde a Fullscreen API não existe, o botão fica oculto sem quebrar o resto.
- **Acessibilidade:** `aria-label` em todo botão de ação, contraste mínimo AA, foco visível. O zoom da regra 11.5 também serve de recurso de acessibilidade visual.
- **Volume esperado no primeiro ano:** dezenas de contas, centenas de livros. Dentro da franquia do Firebase e do plano gratuito da Vercel.
- **Custo:** sem receita no v3, a fatura do Google precisa ficar **em zero**. A regra 11.11 e o alerta de orçamento do Blaze (premissa 4.3) existem exatamente para isso, e são mais importantes aqui do que serão depois que houver receita.
- **Idioma:** interface em pt-BR. Sem i18n no v3.

---

## 18. Convenções de código, documentação e repositório

- **Dados em português, código em inglês.** Coleções e campos do Firestore em português `snake_case` (`titulo`, `publicado`, `criado_em`), assim como os tipos TypeScript que os espelham. Componentes, hooks, funções e nomes de arquivo em inglês (`BookReader.tsx`, `useBookUpload.ts`). A fronteira de idioma fica na camada de acesso a dados.
- **Comentários obrigatórios.** Toda função, hook, rota de servidor, guarda e rotina leva cabeçalho em português dizendo o que faz, o que recebe, o que devolve e **qual regra do spec implementa, com o número** — por exemplo `// Gera o slug a partir do título — regra 11.3`. Lógica não óbvia leva comentário inline. Comentário que repete a sintaxe é ruído.
- **Copy fora dos componentes.** Nenhuma string de interface literal em componente; toda copy vive em `lib/copy.ts`, com os textos da seção 15.
- **Estrutura esperada:**

  ```
  app/
    (public)/            → home, termos, privacidade
    (public)/[handle]/   → vitrine e leitor
    entrar/
    conta/               → handle, livros (menu lateral)
    admin/               → contas (menu lateral)
    api/autores/         api/livros/     → públicas
    api/conta/           → do autor
    api/rotinas/         → cron
    api/admin/           → plataforma
    api/auth/[...nextauth]/
  components/
    reader/  account/  admin/  marketing/
  hooks/
  lib/
    firebase/   admin.ts, firestore.ts, storage.ts
    auth.ts     guardas: requireAutor, requireDonoDoLivro, requireAdminPlataforma
    planos.ts   limites e franquias da regra 11.8
    pdf/render.ts
    copy.ts, slug.ts, books.ts, format.ts
  types/
  tests/
  ```

- **Documentação viva:** `README.md` (setup, variáveis, passo a passo do Firebase), `CLAUDE.md` (convenções, arquitetura, comandos, pegadinhas), `DOCUMENTACAO-TECNICA.md` (seção 19) e `EPICO-COBRANCA.md` (desenho da cobrança, não implementado). Os quatro acompanham a mudança **no mesmo commit**.
- **Variáveis de ambiente:**

  | Variável | Segreda? | Para quê |
  |---|---|---|
  | `FIREBASE_PROJECT_ID` | não | Projeto do Firebase |
  | `FIREBASE_CLIENT_EMAIL` | não | Conta de serviço do Admin SDK |
  | `FIREBASE_PRIVATE_KEY` | **sim** | Chave da conta de serviço. Acesso total ao Firestore e ao Storage |
  | `FIREBASE_STORAGE_BUCKET` | não | Bucket dos arquivos |
  | `GOOGLE_OAUTH_CLIENT_ID` | não | Login |
  | `GOOGLE_OAUTH_CLIENT_SECRET` | **sim** | Login |
  | `NEXTAUTH_SECRET` | **sim** | Assina o cookie de sessão |
  | `NEXTAUTH_URL` | não | URL do deploy |
  | `ADMIN_ALLOWED_EMAILS` | **sim** | Admins **da plataforma**. As contas destes e-mails também nascem `ilimitado` (regra 11.13). No v3: `alexandre.silva.siqueira@gmail.com`, `alexandre@dablab.com.br`, `alexandre.siqueira@outlook.com` |
  | `CRON_SECRET` | **sim** | Protege a rotina da seção 13.4 |
  | `EMAIL_CONTATO` | não | `alexandre@dablab.com.br` (decisão 25.3). Aparece nos termos, na política de privacidade, no canal de denúncia e no botão "Falar com a gente" |
  | `LIVRO_EXEMPLO_HOME` | não | Qual livro a home mostra folheável |

  As variáveis do Stripe entram com a cobrança (seção 8 do `EPICO-COBRANCA.md`).

---

## 19. Documento de documentação técnica

Ao final da implementação, gerar `DOCUMENTACAO-TECNICA.md` na raiz, em português, com:

1. **Modelo de dados em linguagem de negócio** — cada coleção, para que serve, o que cada campo significa, e o que cada valor de enum quer dizer.
2. **Relacionamento entre as coleções** — diagrama em texto e a cardinalidade em vocabulário de negócio.
3. **Onde vive cada regra** — as guardas, as transações e a rotina periódica, com nome exato, quando disparam e o que fazem. Substitui a lista de triggers e políticas que existiria num banco relacional; deve dar para ler essa lista e entender toda a lógica que a tela não mostra.
4. **Mapa tela → rotas → coleções.**
5. **Lógica das principais funcionalidades por tela** — o que é validado, o que é gravado, o que é calculado e onde, e o que o usuário vê no erro.
6. **Divergências em relação a este spec**, com o porquê de cada uma.

Regra de manutenção: toda mudança em coleção, guarda, rota ou lógica de tela atualiza este documento no mesmo commit.

---

## 20. Privacidade, segurança e conformidade

A v3.0 muda a natureza do problema. Na v2.0 não havia dado pessoal de terceiro; agora a plataforma trata dados de outras pessoas.

### Dados tratados

| Dado | De quem | Por quê | Retenção |
|---|---|---|---|
| E-mail, nome e id do Google | Autores | Identificar a conta | Enquanto a conta existir |
| Handle | Autores | É público, forma a URL | Enquanto a conta existir |
| PDFs e capas | Autores | É o produto | Enquanto o livro existir |
| Bytes servidos por mês | Autores | Válvula da regra 11.11 | Mês corrente |

**De leitor não se coleta nada.** Sem conta, sem cookie de rastreamento, sem analytics de terceiro. O contador da regra 11.11 é agregado por conta do autor, nunca por leitor.

**Não há coleta de CPF, CNPJ nem endereço no v3** — eles entram só com a cobrança, e a seção 5 do `EPICO-COBRANCA.md` já registra que a base legal ali passa a ser obrigação fiscal, com retenção de 5 anos.

### LGPD

Com dado pessoal de terceiros, a plataforma passa a ser **controladora**. O v3 precisa entregar:

- **Política de privacidade** em `/privacidade`, dizendo o que se coleta, por quê e por quanto tempo.
- **Termos de uso** em `/termos`, com: o autor declara ter direito sobre o que publica; a plataforma pode despublicar conteúdo que viole os termos ou a lei; canal de denúncia com e-mail de contato.
- **Caminho de exclusão de conta.** Não há botão no v3: a pessoa escreve para `alexandre@dablab.com.br` e o pedido é atendido **em até 30 dias**, apagando conta, handle, livros e arquivos. **Os links que circulavam deixam de funcionar** — e os termos dizem isso com todas as letras, para ninguém ser surpreendido (decisão 25.2).
- **Responsável pelo tratamento:** DabLab, CNPJ 61.033.268/0001-14, contato `alexandre@dablab.com.br` (decisão 25.4).
- **Base legal:** execução de contrato para os dados da conta.

### Segurança

- `FIREBASE_PRIVATE_KEY` é a credencial mais sensível do projeto: dá acesso total aos dados e aos arquivos. Só como variável de ambiente na Vercel, nunca commitada, nunca logada, nunca no cliente.
- As regras do Firestore e do Storage negam todo acesso do cliente (seção 6).
- **Toda a segurança entre contas depende do código das guardas.** Não há RLS por baixo. Por isso a seção 22 trata os testes de autorização como não negociáveis.
- A rotina periódica é protegida por `CRON_SECRET`.

### Conteúdo de terceiros

Hospedar arquivo de outras pessoas traz risco que a v2.0 não tinha: violação de direito autoral, conteúdo ilegal, uso da plataforma como CDN para outra coisa. Mitigação no v3: termos de uso, canal de denúncia e o poder de despublicar da seção 8.7. **Não há moderação proativa nem varredura automática** — é reativo, e isso está declarado.

---

## 21. Métricas de sucesso

| Métrica | Alvo |
|---|---|
| Tempo entre criar a conta e ter o primeiro livro publicado | Menor que 10 minutos, sem consultar documentação |
| Contas que publicam ao menos um livro | Metade das que criam conta |
| Fatura do Google no primeiro ano | **Zero.** Sem receita, qualquer valor é prejuízo |
| Pessoas que esbarram no limite de 5 e pedem mais | **Uma já basta**: é o sinal que libera a implementação do `EPICO-COBRANCA.md` |
| Alexandre parar de pagar o Heyzine | Sim ou não. É o teste original do produto |

---

## 22. Estratégia de teste

**Não negociável, e mais importante do que seria com banco relacional**, porque não existe RLS como segunda camada (seção 20):

- `requireAutor()`, `requireDonoDoLivro()` e `requireAdminPlataforma()`: sem sessão devolve 401; sessão errada devolve 403 (ou **404** no caso do dono); e em nenhum dos casos o Firestore ou o Storage chegam a ser chamados.
- **Isolamento entre contas:** a conta A não lê, edita, publica nem exclui livro da conta B por nenhuma rota. Um teste por rota que aceita id de livro.
- Rascunho devolve 404 nas rotas públicas para qualquer um que não seja o dono.
- Unicidade de handle sob concorrência: duas criações simultâneas do mesmo handle resultam em uma vitória e uma recusa.
- Limite de plano: a rota de criação e a de sessão de upload recusam quando a conta está no limite; excluir um livro libera a vaga.
- Baixar o plano de uma conta acima do novo limite **não** exclui nem despublica nada (regra 11.9).
- Conta com e-mail em `ADMIN_ALLOWED_EMAILS` nasce `ilimitado`, não esbarra em limite nenhum e não dispara aviso de tráfego (regra 11.13); e uma conta comum promovida à mão continua respeitando o limite da faixa.

Manual, antes de cada deploy: o fluxo da seção 9 ponta a ponta. E, ao menos uma vez por release, o leitor num **iPhone e num Android reais** — emulador não valida swipe nem Fullscreen API.

---

## 23. Riscos e mitigação

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| **Vazamento entre contas** por guarda esquecida numa rota | Altíssimo. É o único erro sem conserto | Baixa, se os testes da seção 22 existirem e forem mantidos | Teste por rota, e a regra de que a guarda é a primeira linha. Nunca pular em nome de velocidade |
| **Fatura do Google sem teto.** O Blaze não tem limite de gasto, e no v3 não há receita nenhuma para absorver surpresa | Alto | Média, se um livro viralizar ou alguém abusar | Alerta de orçamento antes do lançamento (premissa 4.3) e a válvula da regra 11.11. Se doer, trocar o Storage por fornecedor sem cobrança de saída — mudança contida em `lib/firebase/storage.ts` |
| **Ninguém usa.** O dono já disse que espera isso, com o Visão de Produto como precedente | Baixo em dinheiro, alto em moral | Alta | É justamente por isso que a cobrança ficou fora: o custo de descobrir isso agora é um mês de trabalho, não um trimestre. O produto tem um usuário garantido — o próprio dono — e um teste claro: cancelar o Heyzine |
| **Conteúdo ilegal ou pirata** hospedado por terceiro | Alto (jurídico) | Média | Termos de uso, canal de denúncia e remoção reativa (seção 20). Sem moderação proativa no v3 |
| **PDF.js travar no celular** com PDF pesado | Alto | Média | Validar cedo (premissa 4.1). Se falhar, pré-renderizar em imagem |
| **`react-pageflip` sem manutenção** (última versão de 2021, dependência flutuante `page-flip: latest`) | Médio | Média | Fixar a versão de `page-flip` no `package.json`. Se quebrar, o wrapper é fino e a biblioteca de baixo é a mantida |

---

## 24. Assunções declaradas

> Assunção não revisada vira verdade no minuto em que o agente começa a codar.

1. **O limite conta rascunhos.** Cinco livros no gratuito são cinco arquivos guardados, publicados ou não — porque o custo é o armazenamento, não a visibilidade. Se você quiser contar só publicados, é um filtro a menos e eu ajusto.
2. **Handle imutável no v3** (regra 11.10), com troca por suporte. Alternativa seria permitir a troca guardando o antigo como redirecionamento, o que dobra a modelagem de handles por um caso raro.
3. **O `autor` do livro é campo editável**, com o nome da conta como padrão — porque quem publica nem sempre é quem escreveu.
4. **As faixas `ate_20`, `ate_50` e `ate_100` já existem no v3**, concedidas à mão. A alternativa era ter só `gratuito` e criar as outras depois, mas aí a migração das contas existentes viraria trabalho — e é justamente o trabalho que fazer agora evita.
5. **Franquias de tráfego de 20/50/100/200 GB** (regra 11.11). São chute calibrado: 20 GB são cerca de 2.200 downloads de um PDF de 9 MB, o que cobre um post que foi bem no LinkedIn. **Revisada e aprovada por Alexandre em 09/09/2026.** Continua sendo o número que segura a fatura sozinho enquanto não houver receita — se a franquia começar a disparar aviso toda semana, ela é o primeiro lugar a reabrir.
6. **Aviso, nunca corte**, ao passar da franquia. Cortar o livro de quem está sendo lido é o pior momento possível para intervir.
7. **Ser admin da plataforma implica ser ilimitado** (regra 11.13). São os mesmos três e-mails, numa variável só, em vez de duas listas para manter em sincronia. A consequência a olhar: se um dia você acrescentar um e-mail de suporte a `ADMIN_ALLOWED_EMAILS`, ele também ganha conta ilimitada. Se isso incomodar, a separação é uma variável nova — me avise.
8. **A home mostra um livro de exemplo** definido por variável de ambiente, não uma lista dos livros de todo mundo — expor livro de autor na home sem ele pedir é usar o conteúdo dele como propaganda.
9. **O `/l/<slug>` da v2.0 simplesmente deixa de existir.** Não há redirecionamento, porque não há links antigos em circulação: nada foi publicado ainda.
10. **A home não menciona preço nem "em breve".** Prometer cobrança futura na home afasta gente sem trazer nada — quando os planos existirem, a página entra.

---

## 25. Perguntas abertas

**Todas respondidas por Alexandre em 09/09/2026.** Ficam registradas aqui, com a
resposta, porque a decisão importa mais que a pergunta — e porque a seção é
referenciada pelo prompt de implementação.

| # | Pergunta | Resposta |
|---|---|---|
| 25.1 | Projeto do Firebase: novo ou reaproveitado? | **Criar um novo**, dedicado ao Virapágina |
| 25.2 | Exclusão de conta: em quanto tempo, e o que acontece com os links? | **Em até 30 dias** do pedido. Conta, handle, livros e arquivos saem juntos, e **os links que circulam deixam de funcionar** — a exclusão é real, não um esconder |
| 25.3 | Endereço de contato dos termos, da privacidade, da denúncia e do botão "Falar com a gente" | **alexandre@dablab.com.br** |
| 25.4 | Nome e CNPJ do responsável pela plataforma nos termos | **DabLab**, CNPJ **61.033.268/0001-14** |

Não há mais pergunta aberta. Se o agente de código encontrar uma decisão que este
documento não toma, ela é nova: pergunte em vez de assumir, e registre aqui.

---

## 26. Definition of Done

- [ ] Épicos 8.1, 8.2, 8.5, 8.6 e 8.7 implementados e validados contra seus critérios.
- [ ] Épicos 8.3 e 8.4 migrados para a nova URL e para o Storage, com os critérios da v2.0 ainda passando.
- [ ] Coleções e campos em português `snake_case`, sem nada fora do padrão.
- [ ] Todas as guardas, rotas e a rotina comentadas em português, com o número da regra que implementam.
- [ ] Regras do Firestore e do Storage publicadas negando todo acesso do cliente.
- [ ] Testes da seção 22 implementados e passando, **em especial os de isolamento entre contas**.
- [ ] Alerta de orçamento configurado no Google Cloud (premissa 4.3).
- [ ] Termos de uso e política de privacidade publicados, com o canal de denúncia.
- [ ] `DOCUMENTACAO-TECNICA.md` gerado e conferido contra o sistema; `CLAUDE.md` e `README.md` em dia.
- [ ] Leitor testado num iPhone e num Android reais.
- [ ] Conta do Alexandre criada e nascida `ilimitado` sozinha, e o livro *Conceitos de Tecnologia* publicado como primeiro título real.
- [ ] Heyzine cancelado.
- [ ] **Nada do `EPICO-COBRANCA.md` implementado** — nem "só a estrutura", nem um campo "para depois".

---

## 27. Próximos passos operacionais

1. Alexandre revisa as seções 24 (Assunções) e 25 (Perguntas abertas). **A 24.5 é a que mais importa.**
2. Criar um projeto **novo** no Firebase (decisão 25.1), ativar Firestore e Storage, subir para o plano Blaze e configurar o alerta de orçamento.
3. Criar a conta de serviço do Firebase e guardar a chave.
4. Configurar as variáveis da seção 18 na Vercel e apontar `virapagina.app.br`.
5. Implementar na ordem da seção 8.
6. Semear os handles reservados.
7. Entrar com o próprio e-mail — a conta nasce `ilimitado` — e publicar o primeiro livro.
8. Trocar o link do Heyzine pelo do Virapágina e cancelar a assinatura.
9. Esperar. Quando alguém esbarrar no limite de 5 e pedir mais, abrir o `EPICO-COBRANCA.md`.

---

## 28. Roadmap: próximas releases

- **Cobrança inteira** — faixas pagas, Stripe em BRL, webhook idempotente, reconciliação diária, rebaixamento que não apaga, cortesia e nota fiscal manual. **Já desenhado, em `EPICO-COBRANCA.md`**, com decisões, modelo de dados, fluxos, telas, copy, variáveis e testes. O gatilho é a primeira pessoa que pedir mais de 5 livros.
- **Analytics de leitura:** aberturas por livro, até que página as pessoas chegam, de onde veio o clique. Exige revisar a seção 20, porque passa a tratar dado de leitor.
- **Domínio próprio do autor** (`livros.empresa.com.br`), com DNS e certificado por cliente.
- **Contas de time:** convidar outra pessoa para publicar na mesma conta, com papéis. Exige papel dentro da conta, que o princípio 0.6 evita hoje.
- **Grade de miniaturas de página** para pular direto a uma página.
- **Capa personalizada à mão**, além da geração automática da primeira página.
- **Atalhos fixos de compartilhamento** (WhatsApp, LinkedIn, X) na barra, além da Web Share API.
- **Som de virar página.**
- **Redirecionamento de handle antigo** ao permitir a troca pelo próprio autor.

---

## 29. Protocolo de mudanças incrementais

Depois que o v3 estiver no ar:

1. Commit de checkpoint antes de qualquer mudança, para ter um `git diff` confiável.
2. Não colar este spec inteiro de novo — colar só o trecho novo, ou um spec adicional da feature. Para a cobrança, colar o `EPICO-COBRANCA.md`.
3. Escrever a instrução como diff sobre o que existe, deixando explícito que o projeto já está implementado e funcionando.
4. Dizer nominalmente o que **não** deve mudar.
5. Pedir a lista de arquivos que serão criados ou alterados **antes** de gerar código, e aprovar.
6. Revisar o `git diff` contra o combinado; reverter o que passou do escopo.
7. Exigir a atualização do `DOCUMENTACAO-TECNICA.md` no mesmo commit.

**Modelo de prompt:**

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

- **Cloud Storage for Firebase — exigência do plano Blaze**, em vigor desde 3 de fevereiro de 2026, e a franquia permanente de 5 GB armazenados e 100 GB de saída mensal. Consultado em 08/09/2026: [FAQ oficial do Firebase](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) e [análise de preços 2026](https://www.budgetforge.dev/tools/firebase-pricing-2026).
- **`EPICO-COBRANCA.md` do projeto Visão de Produto**, de 17/08/2026 — origem do desenho de idempotência por evento, do webhook como fonte da verdade, da reconciliação diária, do rebaixamento que não apaga e da cortesia como coluna.
- **Heyzine** — planos sem marca d'água a partir de ~US$ 14/mês. Consultado em 08/09/2026.
- `react-pageflip` e `pdfjs-dist` (npm), ambos MIT.

---

# Prompt de implementação (colar no Claude Code)

```
Leia o arquivo spec.md inteiro antes de escrever qualquer código. O projeto já
existe em /Users/alexandresiqueira/ViraPagina, implementado na v2.0 — não é um
recomeço. Leia também o DOCUMENTACAO-TECNICA.md para saber o que já está pronto.

Antes de codar: monte um plano e uma lista de tarefas e me mostre para aprovação,
deixando explícito o que será removido da v2.0.

Ordem de implementação:
1. Seção 7 (coleções e índices do Firestore) + seção 6 (guardas e regras de
   segurança) + a camada lib/firebase — dados e autorização primeiro, sempre.
2. Seção 8.1 (conta, identidade e handle).
3. Seção 8.2 (painel do autor, com o limite da regra 11.8).
4. Seções 8.3 e 8.5 (migrar o leitor já pronto para /<handle>/<slug> e a vitrine).
5. Seção 8.6 (home) e as páginas de termos e privacidade.
6. Seção 8.7 (administração da plataforma) e a rotina da seção 13.4.

Escopo: implemente exatamente o que está nas seções 3 (dentro do MVP), 8, 9, 10,
11 e 13.

NÃO implemente nada do EPICO-COBRANCA.md nem da seção 28 (Roadmap). Sem Stripe,
sem tela de preços, sem campo de assinatura, sem dados fiscais — nem "só a
estrutura", nem um campo "para depois". O campo `plano` e o limite da regra 11.8
JÁ fazem parte do MVP e devem ser implementados; o que não entra é o caminho de
pagar por eles.

Os princípios da seção 0 são a regra de desempate. Em especial o 0.3: o navegador
nunca fala com o Firestore nem com o Storage, e as regras de segurança negam todo
acesso do cliente.

Convenções obrigatórias:
- Coleções e campos do Firestore em português, snake_case, e os tipos TypeScript
  que os espelham também.
- Código, variáveis, componentes e nomes de arquivo em inglês.
- Toda função, hook, rota, guarda e rotina leva comentário de cabeçalho em
  português explicando o que faz e qual regra do spec implementa, com o número.
- Toda rota sob /api/conta/* chama requireAutor() como primeira linha, e toda
  rota que toca um livro específico chama requireDonoDoLivro() — sem exceção.
- Siga literalmente a matriz da seção 5, as regras da seção 11 e os critérios da
  seção 8. Não invente valores, limites nem comportamento que não estejam escritos.

Segurança é mais crítica aqui do que num projeto com banco relacional, porque não
há RLS como segunda camada (seções 20 e 23): implemente e rode os testes da seção
22 — em especial os de isolamento entre contas — ANTES de considerar concluído
qualquer épico que toque livro.

Antes de avançar de um épico para o outro, valide cada critério de aceite da
seção 8 correspondente.

Se cruzar com qualquer item da seção 25 (Perguntas abertas), pergunte em vez de
assumir.

Ao final, atualize o DOCUMENTACAO-TECNICA.md com os seis itens da seção 19,
escrito a partir do que foi realmente implementado.
```
