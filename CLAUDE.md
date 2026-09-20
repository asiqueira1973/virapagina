# CLAUDE.md — Virapágina

Instruções para quem for mexer neste repositório, humano ou agente.

Leia o `spec.md` antes de mudar comportamento e o `prompt-design-virapagina.md`
antes de mudar interface. Para o app de iPhone, leia o `spec-ios.md`: ele é o
delta do `spec.md`, e onde os dois divergirem é ele que vale **para o app**. Este
arquivo não os substitui — ele diz como o repositório está montado e o que quebra
se você não souber.

O `DOCUMENTACAO-TECNICA.md` descreve o que **está** implementado, incluindo as
divergências em relação ao spec. Mudou schema, guarda, rota ou lógica de tela?
Atualize-o **no mesmo commit**.

---

## O que é

Plataforma multi-tenant de flipbooks. Qualquer pessoa entra com o Google, escolhe
um endereço público e sobe PDFs; quem recebe o link folheia no navegador, sem
conta. Enquanto `EARLY_ADOPTER_ABERTO` for verdadeiro, toda conta nova nasce com livros
ilimitados, para sempre. Desligada a chave, conta nova nasce com 5 livros.

**Sem banco relacional:** Cloud Firestore para os dados, Cloud Storage para os
arquivos, tudo pelo Admin SDK no servidor.

**Sem cobrança no site.** O desenho inteiro está em `EPICO-COBRANCA.md` e **não
deve ser implementado** — nem "só a estrutura", nem um campo "para depois".

**Com cobrança no app de iPhone**, e só lá: assinatura mensal da App Store, que
dá livros ilimitados enquanto valer. É outra esteira, não a do `EPICO-COBRANCA.md`
— nenhum campo daquele documento existe. Quem chega pelo app nasce com 5 livros;
quem já era early adopter continua ilimitado e nunca vê paywall.

---

## As quatro pegadinhas que não podem ser quebradas

1. **Toda rota `/api/conta/*` chama `requireAutor()` na primeira linha, e toda
   rota que toca um livro chama `requireDonoDoLivro()`.** Sem banco relacional
   não existe RLS como segunda camada: essa linha é a única coisa entre um
   estranho e o conteúdo de todo mundo. Há teste que falha se uma rota tocar o
   Firestore ou o Storage antes de autorizar — **não desative esse teste**.

2. **Livro de outra conta devolve 404, nunca 403.** Responder "existe, mas não é
   seu" confirma a existência de um rascunho alheio. Livro inexistente e livro
   alheio devolvem exatamente a mesma resposta, e há teste comparando as duas.

3. **Nenhuma chamada ao Firestore ou ao Storage acontece no navegador.** Sempre em
   rota de servidor ou componente de servidor. As regras de segurança negam todo
   acesso do cliente — elas não são a autorização, são a garantia de que não
   existe segunda porta.

4. **A renderização do PDF é sempre no navegador.** O servidor nunca converte PDF
   em imagem. O arquivo enviado é a fonte única — o que a pessoa lê é literalmente
   o que ela baixa. Não introduza um pipeline de conversão no servidor sem antes
   mudar a seção 4 do spec.

---

## Comandos

```bash
npm run dev        # servidor local (copia o worker do PDF.js antes)
npm run emu        # emulador do Firebase (vem por npx; exige Java)
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # 145 testes, sem dependência externa
npm run test:emu   # 24 testes de integração — exige `npm run emu` no ar
npm run diagnostico -- ./<chave>.json   # roda as consultas reais contra o Firestore de produção
swift scripts/gerar-icones.swift        # refaz os ícones do site e do app
```

O app de iPhone (veja `ios/README.md`):

```bash
cd ios && xcodegen generate   # o .xcodeproj é derivado do project.yml, não versionado
xcodebuild -project ios/Virapagina.xcodeproj -scheme Virapagina \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Para ver algo em tela local, suba o emulador e semeie uma conta com um livro:

```bash
node scripts/seed-emulador.mjs caminho/do/arquivo.pdf
```

Build sem warning nosso é critério de aceite. Há um aviso conhecido vindo de
`node_modules/jose` (dependência do Auth.js) sobre `CompressionStream` no Edge
Runtime: falso positivo da análise do Next, registrado nas divergências.

---

## Onde as coisas moram

```
app/
  (public)/page.tsx                 → home
  (public)/termos, /privacidade     → documentos legais
  (public)/[handle]/                → vitrine do autor
  (public)/[handle]/[slug]/         → leitor
  entrar/                           → login com Google
  conta/                            → painel do autor (menu lateral)
  admin/                            → painel da plataforma (menu lateral)
  api/autores/, api/livros/         → rotas públicas
  api/conta/                        → do autor, todas com requireAutor()
  api/admin/                        → da plataforma
  api/rotinas/                      → cron
  api/app/                          → do app de iPhone: sessão e assinatura
components/
  reader/    BookReader, PdfPage, FlipbookToolbar, ZoomControls, BookCover
  account/   Sidebar, formulários, diálogos
  platform/  ações do admin sobre uma conta
  marketing/ cabeçalho, rodapé e casca dos documentos
lib/
  firebase/  admin.ts, firestore.ts (ÚNICO que conhece as coleções), storage.ts
  auth.ts    configuração do Auth.js — SEM Firebase, para o Edge
  guards.ts  requireAutor, requireDonoDoLivro, requireAdminPlataforma
  admins.ts  a allowlist, sem imports, para não criar ciclo
  planos.ts  limites e franquias — os números vivem só aqui
  flags.ts   a chave EARLY_ADOPTER_ABERTO, sem imports, para não criar ciclo
  cache.ts   versão das URLs de PDF e capa — sem imports, o leitor é cliente
  visao.ts   eventos de uso para o Visão de Produto — ÚNICO que conhece o serviço
  app-auth.ts   token do app e verificação do id_token do Google
  app-conta.ts  a visão da conta que o app recebe
  appstore.ts   verificação dos JWS da Apple, com a raiz embutida
  pdf/render.ts, copy.ts, slug.ts, books.ts, format.ts
ios/
  project.yml           o projeto; o .xcodeproj é gerado e não versionado
  Configuracao.xcconfig servidor e client do Google
  Virapagina/           App, Design, Rede, Loja, Pdf, Telas
```

**Se um dia isso virar Postgres**, é `lib/firebase/firestore.ts` que muda.
Nenhum outro arquivo sabe que existe Firestore — mantenha assim.

**O sistema visual mora em `app/globals.css`**, no `@theme`, e em nenhum outro
lugar: componente não escreve hexadecimal. Os valores são os mesmos do **Cartão
de Visita** (`~/carta-de-visita`), o outro produto da casa, porque o painel dos
dois é a mesma ferramenta. Nada automatiza essa sincronia além de quem edita:
mudou token aqui, olhe lá — e vice-versa. A tabela está na seção 8 do
`DOCUMENTACAO-TECNICA.md`.

---

## Idioma e comentários

- **Dados em português, `snake_case`:** coleções e campos do Firestore e os tipos
  TypeScript que os espelham (`titulo`, `publicado`, `criado_em`).
- **Código em inglês:** componentes, hooks, funções e nomes de arquivo.
- **Interface e comentários em português.**
- **Zero string de interface literal em componente** — a copy vive em
  `lib/copy.ts`, com os textos exatos da seção 15 do spec.
- **Toda função, hook, rota, guarda e rotina leva cabeçalho em português** dizendo
  o que faz e **qual regra do spec implementa, com o número** — por exemplo
  `// Gera o slug a partir do título — regra 11.3`. Comentário que repete a
  sintaxe é ruído; o que nomeia a regra é o que salva o projeto daqui a seis
  meses.

---

## Quatorze coisas que quebram em silêncio

Cada uma destas já mordeu. Nenhuma dá erro de compilação.

1. **O Firestore não tem índice único.** A unicidade do handle é garantida por uma
   transação sobre a coleção `handles`, e a do slug por leitura antes da escrita.
   Simplificar isso faz dois cadastros simultâneos vencerem os dois.

2. **`settings()` do Firestore só pode ser chamado uma vez, antes de qualquer uso
   da instância** — e no Next cada rota tem seu grafo de módulos, então nenhuma
   sabe se foi a primeira. Não o chame: as escritas limpam `undefined` na origem,
   com `semUndefined()`.

3. **`lib/auth.ts` não pode importar o Firebase.** O middleware roda no Edge, e o
   Admin SDK é de Node. Guarda nova vai em `lib/guards.ts`.

4. **As duas regras de plano se comportam ao contrário uma da outra, e isso é
   intencional.** A do dono (11.13) é reaplicada a cada login, porque é uma
   correção. A do early adopter (11.14) é aplicada **só na criação**, porque é uma
   promessa: reaplicá-la no login faria a chave desligada rebaixar quem já entrou
   e a chave religada promover quem entrou depois. Há teste de integração para as
   duas direções — se ele quebrar, alguém mexeu nisso sem perceber.

5. **`atualizado_em` não tem trigger.** É a aplicação que reescreve o campo em
   toda gravação. Uma escrita nova que esqueça disso deixa a data velha para
   sempre.

6. **O PDF.js recusa dois desenhos no mesmo canvas** e só o libera quando o
   anterior termina — cancelar não basta, é preciso esperar. `PdfPage` enfileira
   os desenhos por página. Simplificar deixa páginas em branco no zoom rápido.

7. **Medir o container só na montagem não funciona.** Numa aba aberta em segundo
   plano o Chrome zera o layout, e o leitor ficaria em branco para sempre —
   cenário comum quando o link chega pelo LinkedIn e a pessoa abre em nova aba.
   Por isso o `BookReader` usa `ResizeObserver`.

8. **Consulta nova com `where` + `orderBy` exige índice composto**, e o Firestore
   só reclama em tempo de execução — nunca no build, nunca no teste com mock. O
   emulador também não reclama: ele não impõe índice. Toda consulta nova entra em
   `firestore.indexes.json` e é publicada, senão a tela quebra só em produção,
   com "Application error" e nada no lugar onde se procura. `npm run diagnostico`
   mostra quais faltam.

9. **Excluir é documento primeiro, arquivos depois.** Ao contrário, sobra
   metadado apontando para arquivo que não existe mais. Há teste da ordem.

10. **O id do documento de um livro é o id da pasta dele no Storage, e quem mexe
    nos arquivos parte de `arquivo_pdf_caminho`, nunca do id.** O id nasce na
    sessão de upload e `criarLivro()` o recebe pronto. Nos livros criados antes
    de 12/09/2026 os dois ids **divergem**, e não há migração — derivar caminho
    do id, nesses, aponta para uma pasta vazia. Foi assim que substituir o PDF
    passou a escrever onde ninguém lê, com a capa atualizando e o arquivo não.

11. **As URLs de PDF e de capa são fixas — quem as monta precisa pôr `?v=`.** Os
    dois arquivos vivem num caminho por livro e são sobrescritos na
    substituição, então o endereço é o mesmo antes e depois. Sem a versão (que
    sai de `atualizado_em`, via `lib/cache.ts`), o navegador e a CDN seguem
    entregando o arquivo velho e o autor vê o livro antigo numa página que
    acabou de atualizar. Isso não aparece em teste nem em desenvolvimento — só
    em produção, e só para quem já tinha aberto o livro.

12. **`garantirUsuario()` roda em toda requisição, e dois parâmetros dela só
    valem na criação.** `origem` decide se a conta nasce early adopter (regra iOS
    10.1) — passá-la no lugar errado promoveria ou rebaixaria quem já existe. E
    `nome` é **opcional, não anulável**: a guarda do bearer não conhece o nome, e
    mandar `null` apagaria o nome da conta a cada tela que o app abrisse.

13. **Um bearer apresentado e recusado não pode cair no cookie.** A guarda
    identifica o pedido por uma credencial só: se veio `Authorization: Bearer` e
    ele não vale, a resposta é 401 — e não a sessão do navegador que porventura
    exista. Deixar cair faria um token vencido do app virar sessão de outra conta
    aberta no mesmo Safari. Há teste.

14. **`registrarEvento()` vai depois da guarda, depois do sucesso, e nunca com
    `await`.** A função é síncrona e não devolve promessa de propósito: o envio
    sai por `after()`, depois de a resposta ter ido. Chamá-la antes da guarda
    mediria tentativa de invasão como uso — e o teste que exige autorização
    antes do Firestore não pega isso, porque o Firestore não é o que está sendo
    chamado. Do mesmo jeito, `VISAO_API_KEY` não entra em `.env.development`:
    aquele arquivo é versionado e roda na máquina de todo mundo, e a chave lá
    faria evento de brincadeira subir junto com o de produção, sem nenhum
    sinal.

---

## O que NÃO implementar

Está no roadmap (spec seção 28) ou no `EPICO-COBRANCA.md`, e ficou de fora de
propósito. Nem "só a estrutura", nem "deixando preparado":

Stripe, tela de preços no site, dados fiscais e nota · **tela de analytics para
o autor** ("quantas pessoas leram meu livro") · domínio próprio do autor ·
contas de time · grade de miniaturas de página · capa customizável à mão ·
atalhos fixos de WhatsApp/LinkedIn/X · som de virar página.

Cuidado para não confundir as duas medições: a **tela** de analytics do autor
está fora, mas a **instrumentação interna** existe e está implementada em
`lib/visao.ts` (spec seção 21). Ela não tem interface nenhuma — é o dono da
plataforma olhando o painel do Visão de Produto.

E do app (`spec-ios.md` seção 13): Login com Apple, iPad, push, leitura offline,
vitrine dentro do app, plano anual e cupom.

O campo `plano` e o limite da regra 11.8 **fazem parte** do MVP e estão
implementados; o que não entra é o caminho de pagar por eles **no site**. No app,
o caminho existe e é o da App Store.

Se algo do roadmap parecer necessário para o v3 funcionar, isso é uma pergunta
para o Alexandre, não uma decisão de implementação.
