# Documentação técnica — Virapágina

Escrito a partir do que está implementado, não do que foi planejado. Cobre os
seis itens exigidos pela seção 19 do `spec.md`. Se alguma coisa aqui não bater
com o código, o código está certo e este documento está velho — corrija-o no
mesmo commit.

**Versão implementada: 3.1**, mais o **app de iPhone** descrito em `spec-ios.md`
— produto multi-tenant sobre Firestore e Cloud Storage, com o mesmo backend
servindo o site e o app.

**Sobre cobrança, são duas coisas diferentes e só uma existe.** A do
`EPICO-COBRANCA.md` — Stripe, tela de preços, dado fiscal, nota — continua **não
implementada**, e nenhum campo dela foi criado. O que existe é a **assinatura da
App Store**, mensal, só dentro do app: ela vive em `lib/appstore.ts`, em
`/api/app/assinatura*` e no campo `assinatura` da conta.

---

## 1. Modelo de dados, em linguagem de negócio

Não há banco relacional. Os dados vivem em quatro coleções do Cloud Firestore, e
os arquivos no Cloud Storage. Nomes de coleção e de campo em português,
`snake_case`, iguais ao que aparece no console do Firebase.

### `usuarios` — as contas

Id do documento: o `sub` do Google. **O e-mail nunca é chave**, porque e-mail de
conta Google pode mudar.

| Campo | O que significa |
|---|---|
| `email` | Espelho do Google, para exibição e suporte |
| `nome` | Nome do Google. Nulo quando a conta não expõe |
| `handle` | O endereço público que forma a URL (`virapagina.app.br/<handle>`). **Nulo até o primeiro acesso concluir a escolha** — é o único estado em que a conta existe sem URL pública, e o painel inteiro redireciona para a escolha enquanto ele for nulo |
| `plano` | A faixa de limite de livros. Um de: `gratuito`, `early_adopter`, `assinante`, `ate_20`, `ate_50`, `ate_100`, `ilimitado` |
| `origem` | Por onde a conta nasceu: `web` ou `app`. Gravado **só na criação** e nunca corrigido. É o que faz conta criada pelo app não herdar o early adopter (regra iOS 10.1). Documento sem o campo é lido como `web`, que é a verdade — todos nasceram no site |
| `assinatura` | O estado da assinatura da App Store, ou ausente. Guarda produto, `transacao_original_id`, status, vencimento e ambiente. Quem escreve é o servidor, depois de conferir o JWS com a cadeia de certificados da Apple |
| `trafego_mes_bytes` | Quantos bytes de PDF e capa foram servidos para os livros desta conta no mês corrente |
| `trafego_mes_referencia` | O mês do contador, em `AAAA-MM`. Quando não bate com o mês de hoje, o contador recomeça do zero |
| `criado_em`, `atualizado_em` | Datas. `atualizado_em` é reescrito pela aplicação em toda gravação — **não existe trigger** |

**O que cada plano dá** (`lib/planos.ts` é a única fonte desses números):

| Plano | Limite de livros | Franquia de tráfego | Como se chega nele |
|---|---|---|---|
| `gratuito` | 5 | 20 GB/mês | Padrão quando a plataforma **não** está mais aberta |
| `early_adopter` | **sem limite** | 200 GB/mês | **Automático** para toda conta criada **pelo site** enquanto `EARLY_ADOPTER_ABERTO` for verdadeiro. É vitalício. Conta criada pelo app nunca cai aqui |
| `assinante` | **sem limite** | 200 GB/mês | Assinatura mensal ativa na App Store. Some quando a assinatura caduca — e **nenhum livro sai do ar** quando isso acontece |
| `ate_20` | 20 | 50 GB/mês | Concedido à mão na tela de admin |
| `ate_50` | 50 | 100 GB/mês | Concedido à mão na tela de admin |
| `ate_100` | 100 | 200 GB/mês | Concedido à mão na tela de admin |
| `ilimitado` | sem limite | sem franquia | **Automático** para todo e-mail em `ADMIN_ALLOWED_EMAILS` |

O limite conta **todos** os livros da conta, rascunho e publicado, porque o custo
é o arquivo guardado, não a visibilidade.

### `handles` — a reserva dos endereços públicos

Id do documento: o próprio handle, em minúsculas. Guarda `usuario_id` e
`criado_em`.

Existe por um motivo só: **o Firestore não tem índice único**. Sem esta coleção,
dois cadastros simultâneos escolhendo o mesmo endereço venceriam os dois, e um
herdaria os links do outro. Os 19 nomes reservados do produto (`admin`, `api`,
`termos`, `precos`…) ficam aqui como constante em código, não como documentos.

### `livros`

Id do documento: um UUID gerado pela aplicação.

| Campo | O que significa |
|---|---|
| `dono_id` | A conta dona. **Todo livro tem dono**, e é a comparação deste campo com a sessão — não a URL — que define o que cada pessoa alcança |
| `titulo`, `subtitulo`, `descricao` | O que aparece na vitrine e no card de compartilhamento |
| `slug` | O trecho final da URL. **Único por dono, nunca globalmente**: duas pessoas podem ter `/ana/revista` e `/bruno/revista` |
| `autor` | O nome exibido. Editável, porque quem publica nem sempre é quem escreveu |
| `arquivo_pdf_caminho`, `capa_caminho` | Onde os arquivos estão no Storage. **Nunca chegam ao navegador** |
| `arquivo_pdf_tamanho_bytes`, `total_paginas` | Lidos do PDF no navegador, no upload. Nulos só quando a leitura falha — e isso não impede publicar |
| `publicado` | Se está no ar. Dois estados só: rascunho e publicado |
| `removido_por_denuncia` | Despublicado pelo admin da plataforma. Enquanto for verdadeiro, o dono **não consegue republicar** |
| `criado_em`, `atualizado_em` | Datas. Ordenam a vitrine e a lista do painel |

**Excluir é definitivo**: o documento sai, e **depois** os arquivos. Nessa ordem,
para nunca sobrar metadado apontando para arquivo que não existe mais.

### `acoes_admin` — auditoria da plataforma

Quem fez (`admin_email`), o quê (`acao`: `alterou_plano`, `alterou_handle`,
`removeu_livro`, `consultou_conta`), sobre quem (`conta_alvo`, `livro_alvo`), o
antes e o depois (`detalhe`) e quando (`feito_em`).

Vale para o dono também. Auditoria com exceção para o dono não é auditoria.

### Os arquivos no Storage

Um livro, uma pasta: `livros/<dono_id>/<livro_id>/original.pdf` e
`.../capa.png`. Assim apagar o livro é apagar a pasta, e não caçar arquivo solto.

**O id do documento é o id da pasta.** O id nasce na sessão de upload, porque o
arquivo precisa cair no lugar definitivo antes de existir documento, e
`criarLivro()` recebe esse mesmo id em vez de sortear um. Enquanto sorteava — até
12 de setembro de 2026 — documento e pasta eram dois ids diferentes, e qualquer
caminho derivado do id do documento apontava para uma pasta vazia.

Os livros criados antes disso continuam com os dois ids divergentes, e não há
migração: quem mexe nos arquivos de um livro existente parte de
`arquivo_pdf_caminho`, nunca do id. É a única fonte confiável de onde o livro
mora, porque é o que o leitor abre. `pastaDoLivroPeloPdf()` e `capaAoLadoDoPdf()`
existem para isso.

---

## 2. Relacionamento entre as coleções

```
usuarios 1 ────< livros            (livros.dono_id)
usuarios 1 ──── 1 handles          (handles.usuario_id)
usuarios 1 ────< acoes_admin       (acoes_admin.conta_alvo)
livros   1 ────< acoes_admin       (acoes_admin.livro_alvo)
```

- **Um autor tem muitos livros; um livro pertence a exatamente um autor.** Não
  existe livro sem dono, e nada no produto move um livro entre contas.
- **Um autor tem exatamente um endereço público; um endereço pertence a um
  autor.** A reserva e a troca acontecem numa transação que escreve nas duas
  coleções de uma vez.
- **Uma conta e um livro podem ser alvo de muitas ações de admin.** O registro é
  histórico: nada nele é apagado por ação da interface.

O Firestore não impõe nenhuma dessas relações. Todas são responsabilidade do
código, em `lib/firebase/firestore.ts`.

---

## 3. Onde vive cada regra

Não há trigger nem política de banco. O que num banco relacional seria RLS mora
nestes lugares, e em nenhum outro.

### As três guardas (`lib/guards.ts`)

| Guarda | Onde | O que faz |
|---|---|---|
| `requireAutor()` | Primeira linha de toda rota `/api/conta/*` | Sem sessão, `401`. Com sessão, **garante que a conta existe** (é aqui que ela nasce no primeiro acesso) e devolve o documento. Sem handle, `409` com o destino da tela de escolha |
| `requireDonoDoLivro(id)` | Toda rota que toca um livro específico | Roda a guarda acima e compara `livro.dono_id` com a sessão. Livro de outra conta devolve **404, não 403** |
| `requireAdminPlataforma()` | Primeira linha de toda rota `/api/admin/*` | Sem sessão, `401`. E-mail fora de `ADMIN_ALLOWED_EMAILS`, `403` |

E a irmã sem erro, `sessaoAtual()`, que as rotas públicas usam para decidir se
mostram o rascunho ao próprio dono.

**Por que 404 e não 403 no caso do dono.** Responder "existe, mas não é seu"
confirma a existência de um rascunho alheio. Livro inexistente e livro de outra
pessoa devolvem exatamente a mesma resposta — e há teste que compara as duas.

### As duas regras de plano, e por que se comportam ao contrário uma da outra

Ambas vivem em `garantirUsuario()`, que roda em **todo** login e em toda entrada
no painel. A diferença entre elas é a coisa mais fácil de quebrar neste código.

| Regra | Quando é aplicada | Por quê |
|---|---|---|
| **11.13** — contas do dono são `ilimitado` | **A cada login** | É uma correção: se o e-mail entrar em `ADMIN_ALLOWED_EMAILS` depois, a conta se conserta sozinha; se alguém a rebaixar no console, o próximo login desfaz |
| **11.14** — conta nova é `early_adopter` | **Só na criação, uma vez** | É uma promessa. Reaplicá-la no login faria a chave desligada **rebaixar** quem já entrou, e a chave religada **promover** quem entrou depois. As duas coisas quebrariam o "vitalício", em direções opostas |

Quando as duas se aplicam, **a do dono vence**: um e-mail da plataforma nasce
`ilimitado`, não `early_adopter` — senão a conta do dono ficaria com franquia de
tráfego e apareceria como early adopter na tela de admin.

A função só grava quando algo mudou de verdade — login não gera escrita à toa. E
o bloco de correções por login **não toca em `early_adopter`**, de propósito.

### A chave que abre e fecha a plataforma

`EARLY_ADOPTER_ABERTO`, lida em `lib/flags.ts`. O padrão é **ligado**: variável
ausente ou escrita errado deixa a plataforma aberta. Errar para o lado de dar
acesso a mais gente é recuperável; errar para o lado de negar cria uma leva de
contas gratuitas que deveriam ter sido vitalícias, e isso não dá para consertar
depois sem saber quem entrou quando.

Fecha só com um "não" explícito: `false`, `0`, `nao` ou `não`, em qualquer caixa.

O estado dela aparece no topo de `/admin/contas`, porque é olhando a lista de
contas que se decide fechar a porta. **Mudá-la exige refazer o deploy na Vercel**
— ver as divergências.

### As duas transações

| Função | Por que precisa ser transação |
|---|---|
| `reservarHandle()` | Grava o documento em `handles` com `create` (que falha se já existir) e o campo `handle` em `usuarios` de uma vez. É o que faz um dos dois cadastros simultâneos perder — sem ela, ambos venceriam |
| `trocarHandle()` | Reserva o novo, libera o antigo e atualiza a conta atomicamente. Sem isso, uma falha no meio deixaria a pessoa sem endereço nenhum |

### A rotina periódica

`POST /api/rotinas/avisar-trafego`, diária, protegida por `CRON_SECRET`. Percorre
as contas, calcula a fração da franquia consumida e sinaliza quem passou de 80%
(aviso ao autor) e de 100% (aviso ao dono). **Não corta, não despublica e não
cobra.** Conta `ilimitado` não tem franquia e nunca aparece.

### A contabilidade do tráfego

`somarTrafego()` é chamada pelas rotas de proxy do PDF e da capa, **sem `await`**:
uma falha na contagem não pode impedir alguém de ler um livro. A soma zera
sozinha quando o mês vira. É contagem aproximada de propósito — ver as
divergências.

### O cache do PDF e da capa (`lib/cache.ts`)

As rotas de proxy têm endereço fixo: `/api/livros/<handle>/<slug>/pdf` é o mesmo
antes e depois de substituir o arquivo. Quem monta essas URLs — leitor, capa da
vitrine, capa do painel, botões de baixar e imprimir, imagem do card de
compartilhamento — acrescenta `?v=<versão>`, e a versão vem de `atualizado_em`,
reescrito em toda gravação. Trocar o PDF muda a URL, e URL nova não tem cache.

A política sai de `cabecalhosDeCache()` e tem três casos:

| Situação | `Cache-Control` | Por quê |
|---|---|---|
| Rascunho em prévia | `private, no-store` | Pode sair do ar a qualquer momento; cache de CDN sobreviveria ao despublicar |
| Publicado, com `?v=` | `public, max-age=31536000, immutable` | Trocar o arquivo troca a URL, então o que está guardado nunca fica errado |
| Publicado, sem versão | `public, max-age=0, must-revalidate` | Link antigo, scraper ou endereço digitado à mão — precisa perguntar toda vez |

As duas rotas mandam também um `ETag`, que é a **geração do objeto no Storage** —
ela muda a cada sobrescrita. Com ele, a revalidação do terceiro caso custa um 304
de poucos bytes em vez do PDF inteiro, e o 304 sai **antes** de `somarTrafego()`:
resposta sem corpo não consome franquia.

`lib/cache.ts` não importa nada além de um tipo, de propósito. O leitor é
componente de cliente, e um import indireto do Firestore levaria o Admin SDK para
o pacote do navegador — o build quebra, como quebrou ao primeiro rascunho desta
correção.

### As trancas do Firestore e do Storage

`firestore.rules` e `storage.rules` negam **toda** operação vinda do cliente.
Isso não é a camada de autorização — as guardas são. É a garantia de que não
existe segunda porta: mesmo que uma chave pública do Firebase vaze, ela não abre
nada. O Admin SDK, usado no servidor, passa por cima das regras por definição.

---

## 4. Mapa tela → rotas → coleções

| Tela | Lê | Escreve |
|---|---|---|
| `/` Home | — (a ilustração é estática) | — |
| `/termos`, `/privacidade` | — | — |
| `/entrar` | — | Auth.js em `/api/auth/*` |
| `/conta/handle` | `usuarios` (servidor) · `GET /api/conta/handle` para a disponibilidade | `POST /api/conta/handle` → `handles` + `usuarios` |
| `/<handle>` Vitrine | `usuarios`, `livros` (servidor, cache de 60s) | — |
| `/<handle>/<slug>` Leitor | `usuarios`, `livros` (servidor) · `/api/livros/<handle>/<slug>/pdf` e `/capa` | `usuarios` (contador de tráfego, pelas rotas de proxy) |
| `/conta/livros` | `usuarios`, `livros` (servidor, sem cache) | — |
| `/conta/livros/novo` | `GET /api/conta/livros/slug-disponivel` | `POST /api/conta/livros/sessao-upload` → Storage → `POST /api/conta/livros` |
| `/conta/livros/[id]` | `livros` (servidor) | `PUT`/`DELETE /api/conta/livros/[id]`, `/publicar`, `/despublicar`, `/substituir-pdf` |
| `/admin/contas` | `usuarios`, `livros` (servidor) · o estado da chave `EARLY_ADOPTER_ABERTO` | — |
| `/admin/contas/[id]` | `usuarios`, `livros` (servidor) | `/api/admin/contas/[id]/plano`, `/handle`, `/api/admin/livros/[id]/remover` → `acoes_admin` |

**As telas leem em componente de servidor e escrevem por rota de API.** Ler
direto continua sendo servidor — a credencial não vai ao navegador — e evita uma
ida e volta HTTP para a página renderizar a si mesma.

---

## 5. Lógica das principais funcionalidades, por tela

### `/entrar` e `/conta/handle`

Qualquer conta Google entra: **não existe allowlist para autores**. A conta nasce
no plano gratuito, sem handle. Enquanto o handle for nulo, todo o painel
redireciona para a tela de escolha — sem endereço público não existe produto.

A tela sugere um handle a partir do nome do Google (ou do trecho antes do `@`),
normaliza o que a pessoa digita para o formato aceito enquanto ela digita —
recusar depois o que a tela deixou escrever é armadilha —, e checa a
disponibilidade com uma pausa de 350 ms para não disparar uma requisição por
tecla. A checagem que vale é a do `POST`, dentro da transação.

O aviso de que **a escolha é definitiva** aparece antes de a pessoa decidir, não
depois.

### `/conta/livros`

Mostra só os livros do próprio dono, com o uso contra o limite ("3 de 5 livros").
Atingido o limite, o botão "Novo livro" fica desabilitado e aparece o aviso com
"Falar com a gente", que abre um e-mail — enquanto não há cobrança, quem libera
mais espaço é o dono da plataforma. **Nenhum livro sai do ar por causa disso.**

### `/conta/livros/novo`

A ordem das etapas foi escolhida para não deixar lixo no Storage:

1. O slug é sugerido em kebab-case do título e para de acompanhá-lo assim que o
   autor edita o campo.
2. O arquivo é validado **no navegador**: precisa ser PDF e não passar de 100 MB.
3. No envio, o slug é conferido no servidor **antes** de o arquivo subir.
4. O PDF é lido no navegador para extrair o total de páginas e desenhar a
   primeira página como capa PNG.
5. A rota da sessão de upload confere o limite do plano e **cunha o id do livro**,
   para o arquivo já nascer na pasta definitiva. O navegador envia os bytes
   direto ao Google, com progresso real vindo do XHR.
6. Só depois o documento entra no Firestore, como rascunho.
7. Se a gravação falhar com o arquivo já enviado, a pasta é apagada — o PDF não
   fica órfão.
8. Falhou? A mensagem aparece e **os campos preenchidos permanecem**.

### `/conta/livros/[id]`

Quatro ações separadas: salvar metadados (nunca pede o PDF de novo), publicar ou
despublicar, substituir o PDF (recalcula páginas e tamanho e regenera a capa,
reaproveitando a pasta do livro) e excluir (diálogo que **nomeia o livro**).

Substituir o PDF tem duas sutilezas, e as duas já falharam em produção. A sessão
de upload da substituição escreve **no caminho que o livro registra**
(`arquivo_pdf_caminho`), não num derivado do id — ver "Os arquivos no Storage". E
a gravação reescreve `atualizado_em`, que é o que muda o `?v=` das URLs do
arquivo e da capa — ver "O cache do PDF e da capa". Sem a primeira, o arquivo
novo ia para uma pasta que ninguém lê; sem a segunda, ele chegava mas ficava
escondido atrás do cache.

Trocar o slug de um livro publicado abre um diálogo avisando que o link antigo
vai quebrar. Livro removido por denúncia mostra o aviso e tem o botão "Publicar"
desabilitado.

### `/<handle>` e `/<handle>/<slug>`

A vitrine lista só publicados — **nem para o próprio dono**: conferir rascunho é
papel da prévia, que é a própria URL do livro aberta pelo dono logado.

O leitor é o mesmo da v2.0, migrado para a URL nova. O PDF é renderizado página a
página em `<canvas>` pelo PDF.js dentro do `react-pageflip`: página dupla acima
de 1024px e única abaixo, virada por clique na borda, arrasto, swipe e setas do
teclado, zoom de 75% a 250% em passos de 25% que persiste ao virar, tela cheia
onde o navegador suporta, baixar, imprimir e compartilhar. Só as páginas próximas
da atual são desenhadas — três para cada lado.

Três defeitos do leitor foram corrigidos ainda na v2.0 e continuam corrigidos: a
fila de desenho por canvas (o PDF.js recusa dois desenhos simultâneos no mesmo
canvas e só o libera quando o anterior termina), a página que ficava desenhada
mas invisível, e a medição por `ResizeObserver` — sem ela, uma aba aberta em
segundo plano deixava o leitor em branco para sempre.

### `/admin/contas` e `/admin/contas/[id]`

Quem não é admin da plataforma recebe **404**, não uma tela de acesso negado —
que confirmaria que a rota existe. Vale também para quem não está logado.

A lista mostra plano, livros e tráfego contra a franquia, com destaque para quem
passou de 80%. **Nunca mostra rascunho de ninguém.** No detalhe estão as três
ações: alterar plano (recusada para contas da plataforma, que são ilimitadas por
definição), trocar handle e remover livro publicado por denúncia. Toda ação,
inclusive a consulta, entra em `acoes_admin`.

---

## 6. Divergências em relação ao spec

### 6.1 As guardas ficam em `lib/guards.ts`, não em `lib/auth.ts`

A seção 18 do spec põe `requireAutor` e as irmãs dentro de `lib/auth.ts`. Elas
tocam o Firestore, e o `middleware.ts` — que roda no **Edge Runtime** — importa a
configuração do Auth.js. Um arquivo só faria o middleware puxar o Firebase Admin
SDK, que é de Node, e ele nem carregaria. `lib/auth.ts` ficou magro e seguro para
o Edge; as guardas moram ao lado.

### 6.2 `settings({ ignoreUndefinedProperties })` não é usado

A forma óbvia de evitar que um `undefined` derrube uma escrita é essa
configuração do Firestore. Ela **só aceita ser chamada uma vez e antes de
qualquer outro uso da instância** — e no Next.js cada rota tem o seu próprio
grafo de módulos, então nenhuma consegue saber se foi a primeira. Na prática, a
segunda rota a rodar derrubava a requisição com "Firestore has already been
initialized", e a falha dependia da ordem em que as páginas eram abertas.

A solução foi limpar na origem: `semUndefined()` roda em toda escrita de
`lib/firebase/firestore.ts`. Mesmo efeito, sem depender de ordem de execução.

### 6.3 A rota da sessão de upload devolve o id do livro

A seção 13.2 descreve a rota como quem só abre a sessão. Ela também **cunha o id
do livro**, porque o caminho do arquivo inclui esse id
(`livros/<dono>/<livro>/original.pdf`) e o arquivo precisa nascer na pasta
definitiva — antes, portanto, de o documento existir. O `POST /api/conta/livros`
recebe esse id de volta.

### 6.4 `GET` em `/api/conta/handle`

A seção 13.2 lista só o `POST`. O `GET` foi acrescentado no mesmo arquivo, para a
tela avisar da indisponibilidade enquanto a pessoa digita. A checagem que decide
continua sendo a transação do `POST`.

### 6.5 Os avisos de tráfego não são enviados por e-mail

A seção 13.4 diz que a rotina "avisa o autor por e-mail". **Não há provedor de
e-mail configurado no projeto**, e escolher um é decisão do Alexandre. A rotina
está implementada e calcula quem passou de 80% e de 100%; hoje ela registra isso
no log de servidor, e a tela de admin destaca as contas em alerta — que é onde o
dono realmente olha. Ligar o envio é acrescentar um provedor e uma chamada.

### 6.6 A home não tem exemplo folheável de verdade

O critério 8.6 pede "um exemplo real folheável" na home. A plataforma nasce sem
nenhum livro publicado, então não há o que embutir. A home traz uma **ilustração
estática** de um livro aberto, e a variável `LIVRO_EXEMPLO_HOME` prevista na
seção 18 não é lida por ninguém. Quando o primeiro livro estiver publicado, trocar
a ilustração pelo leitor de verdade é uma mudança pequena e localizada.

### 6.7 As telas de admin leem em componente de servidor

Como no painel do autor, `/admin/contas` e `/admin/contas/[id]` leem direto do
Firestore em componente de servidor. A rota `GET /api/admin/contas` da seção 13.3
existe e é testada, mas as telas não passam por ela.

### 6.8 O handle reservado `precos` não tem tela

`precos` está entre os nomes reservados desde já, para o dia em que a cobrança
entrar. A tela não existe no v3 (`EPICO-COBRANCA.md`).

### 6.9 Aviso conhecido no build

O `next build` emite um aviso vindo de `node_modules/jose` (dependência do
Auth.js): `CompressionStream` não seria suportado no Edge Runtime. É um falso
positivo da análise estática do Next — a API existe no Edge Runtime da Vercel e o
middleware funciona. O aviso não vem de código nosso.

### 6.10 A chave do early adopter é variável de ambiente, não interruptor na tela

A regra 11.14 não diz onde a chave mora. Ela ficou em `EARLY_ADOPTER_ABERTO`,
seguindo o mesmo padrão de `ADMIN_ALLOWED_EMAILS`: sem coleção nova, sem leitura
extra no caminho do cadastro, e testável.

**A consequência:** desligá-la exige mudar a variável na Vercel **e refazer o
deploy** — cerca de dois minutos, não um clique. O estado aparece em
`/admin/contas` para ser descoberto sem precisar lembrar da variável. Se um dia
o interruptor na tela fizer falta, mover a chave para um documento no Firestore é
uma mudança pequena e contida.

### 6.11 O early adopter mantém franquia de tráfego

O pedido foi "acesso ilimitado vitalício, similar ao que eu tenho como admin". A
conta do dono não tem franquia nenhuma; a do early adopter tem — 200 GB por mês,
a mesma da faixa mais alta.

**Por quê:** a franquia não limita nada. Ela só dispara aviso (regra 11.11).
Zerá-la, como no plano do dono, tiraria o único alarme que existe contra a fatura
do Blaze — que não tem teto — numa categoria que pode crescer para centenas de
contas, enquanto o plano do dono são três. Livros continuam ilimitados de
verdade. Está registrado como assunção 24.8, e voltar ao comportamento pedido é
trocar `200 * GB` por `null` em `lib/planos.ts`.

### 6.12 O contador de tráfego é aproximado

O Firestore tolera cerca de uma escrita por segundo no mesmo documento. Um livro
viral gera mais leituras do que isso, e parte da contagem se perde. Para uma
válvula que existe para **gerar conversa** — não corte nem cobrança —, contagem
aproximada basta. A alternativa (agregação em outra coleção, somada por rotina)
custaria mais do que o problema.

---

## 7. O app de iPhone

Implementado a partir do `spec-ios.md`. O app é **cliente do mesmo backend**:
nenhuma regra de negócio foi reescrita em Swift, e o Firestore continua fora do
alcance do aparelho.

### O que mudou no servidor

| Onde | O que |
|---|---|
| `lib/app-auth.ts` | Emite e confere o token do app (JWT HS256, 30 dias, mesmo `NEXTAUTH_SECRET` da web) e valida o `id_token` do Google contra o JWKS, o emissor, o prazo e o `aud` do client **iOS**. Sem biblioteca: `node:crypto` faz as duas assinaturas |
| `lib/guards.ts` | `requireAutor()` e `sessaoAtual()` passam a aceitar `Authorization: Bearer` além do cookie, lendo o cabeçalho por `headers()`. **Nenhuma rota existente mudou de assinatura** — as de `/api/conta/*` atendem os dois clientes como estavam |
| `lib/appstore.ts` | Verifica os JWS da Apple: cadeia de três certificados, validade, e a raiz comparada **byte a byte** com a Apple Root CA - G3 embutida no arquivo. É o que separa uma assinatura de verdade de um JSON inventado |
| `lib/app-conta.ts` | A visão da conta que o app recebe nas três rotas que a devolvem |
| `lib/books.ts` | `toLivroDoAutor()` monta as URLs pública, de PDF e de capa **já com `?v=`** — a regra do cache mora num lugar só, e não no Swift |
| `firestore.ts` | `origem` na criação da conta, `definirAssinatura()`, `buscarUsuarioPorTransacaoOriginal()` e `excluirUsuario()` |

### Rotas novas

| Rota | O que faz |
|---|---|
| `POST /api/app/sessao` | Troca o `id_token` do Google pelo token do app. É a única rota que autentica do zero — o que faz o papel da guarda é a verificação do token |
| `GET /api/app/conta` | Conta, plano, uso contra o limite e assinatura. Roda com `exigeHandle: false`, porque precisa responder justamente para quem ainda não escolheu endereço |
| `POST /api/app/assinatura` | Recebe o JWS da compra, confere com a Apple, grava o plano. Recusa assinatura já vinculada a outra conta |
| `POST /api/app/assinatura/notificacoes` | As App Store Server Notifications V2. **Sem guarda de sessão, e corretamente**: quem chama é a Apple, e a autenticação é a assinatura do JWS |
| `GET /api/conta/livros` e `GET /api/conta/livros/[id]` | O que a web monta em componente de servidor, agora também como rota |
| `DELETE /api/conta` | Apaga conta, livros, arquivos e handle. Exigência da App Review, e o site ainda não tem equivalente |

### As duas regras de negócio próprias do app

- **Conta criada pelo app nasce `gratuito`**, com 5 livros, mesmo com
  `EARLY_ADOPTER_ABERTO` ligada (regra iOS 10.1). Quem já existe **não muda de
  plano** ao entrar pelo app: early adopter que baixa o app continua ilimitado e
  não vê paywall (regra iOS 10.2).
- **Perder a assinatura não tira nada do ar** (regra iOS 10.4). A conta volta
  para `gratuito` e perde só o direito de criar o próximo livro. O paywall diz
  isso antes da compra, com todas as letras.

### O app

SwiftUI, iOS 17+, **zero dependências**: o login usa `ASWebAuthenticationSession`
com PKCE (que é o que o SDK do Google faz por dentro), a rede usa `URLSession`, o
PDF usa `PDFKit` e a assinatura usa StoreKit 2. O projeto é gerado por XcodeGen a
partir de `ios/project.yml`; o `.xcodeproj` não está no Git.

O leitor do app **não** é o flipbook do site: lá é `react-pageflip` com PDF.js,
aqui é o PDFKit, página a página na horizontal. A diferença está declarada na
seção 14 do `spec-ios.md`. O que não muda é a regra que importa — o PDF original
é a fonte, renderizado no cliente, e o servidor nunca converte PDF em imagem. A
capa continua sendo a primeira página, agora desenhada pelo PDFKit no aparelho,
nas mesmas medidas da web.

---

## 8. O sistema visual, em tokens

Os tokens vivem no `@theme` do `app/globals.css`, e **só lá** — nenhum
componente escreve hexadecimal. A adaptação ao padrão do ChatGPT Ads mudou o
papel das cores, não a quantidade delas:

| Token | Valor | Onde aparece |
|---|---|---|
| `--color-acao` | `#101113` | Botão primário, foco de teclado, barra de progresso, borda de campo em foco |
| `--color-acao-clara` | `#2C2E33` | Hover do botão primário |
| `--color-marca` | `#1C5FD8` | O quadradinho do logo e o selo da conta da plataforma. Nada mais |
| `--color-marca-fraca` | `#EEF3FD` | Fundo desse mesmo selo |
| `--color-preenchimento` | `#EFEFF1` | Pílula do item de menu ativo, chip de plano selecionado, área de upload recebendo arquivo |
| `--color-perigo` | `#A32020` | Só perigo e alerta |
| `--color-publicado` | `#1A7F4B` | Só o selo "Publicado" |

**O que era azul e deixou de ser:** botão primário, item ativo do menu, link,
ícone da home, barra de progresso, borda de campo em foco, faixa de early
adopter no admin e anel de foco. Todos viraram neutro. Quem procurar
`bg-destaque` no código não acha mais nada: os tokens `--color-destaque*` foram
removidos, e não existe apelido de compatibilidade.

**Link sem cor própria** é a única mudança que mexe em acessibilidade: como não
há mais contraste de cor separando link de texto, o sublinhado passou a ser
permanente nos documentos longos (`/termos`, `/privacidade`) em vez de aparecer
só no hover.

---

## 9. Instrumentação de uso (`lib/visao.ts`)

O servidor manda eventos para o **Visão de Produto** — é assim que as métricas
da seção 21 do spec são medidas. Um módulo só, e ele é o único que conhece esse
serviço.

**Isto não é o "analytics de leitura" da seção 28 do spec**, que continua fora:
aquele é uma tela para o autor ver o desempenho dos livros dele. Este é
instrumento do dono da plataforma e não tem interface nenhuma.

### As quatro regras do envio

1. **Só no servidor.** A chave `VISAO_API_KEY` é secreta e não chega ao
   navegador, como o Firestore não chega.
2. **Nunca derruba nem atrasa a resposta.** O envio sai por `after()` do Next,
   depois de a resposta ter ido, com timeout de 5s, e todo erro morre no
   `console.error`. Fora de um ciclo de requisição o `after()` lança, e aí o
   envio vira disparo solto — pode se perder, não atrapalha ninguém.
3. **Sem chave, não envia.** Desenvolvimento, teste e emulador ficam
   silenciosos. `tests/setup.ts` não define a variável de propósito.
4. **Depois da autorização e depois do sucesso.** Antes da guarda mediria
   tentativa de invasão como uso; antes da escrita, mediria o que não aconteceu.

### Os eventos

Todos com o prefixo `vira_pagina_`. O `distinct_id` é o e-mail de quem agiu.

| Evento | Onde nasce | Tela | Propriedades |
|---|---|---|---|
| `conta_criada` | `garantirUsuario()`, só no ramo de criação | `Entrar` | `origem`, `plano` |
| `app_entrou` | `POST /api/app/sessao` | `Entrar` | `provedor` (google/apple), `plano` |
| `handle_escolhido` | `POST /api/conta/handle` | `EscolherEndereco` | `handle` |
| `livro_criado` | `POST /api/conta/livros` | `NovoLivro` | `total_paginas`, `tamanho_bytes`, `livros_na_conta` |
| `livro_publicado` | `POST /api/conta/livros/[id]/publicar` | `EditarLivro` | `endereco`, `total_paginas` |
| `livro_despublicado` | `POST .../despublicar` | `EditarLivro` | `endereco` |
| `pdf_substituido` | `POST .../substituir-pdf` | `EditarLivro` | `total_paginas`, `tamanho_bytes`, `publicado` |
| `livro_excluido` | `DELETE /api/conta/livros/[id]` | `EditarLivro` | `publicado` |
| `livro_lido` | render de `/<handle>/<slug>` | `Leitor` | `endereco`, `autor`, `total_paginas` |
| `assinatura_confirmada` | `POST /api/app/assinatura` | `Assinatura` | `produto`, `expira_em`, `plano` |

### Três decisões que valem saber

**`conta_criada` mora dentro de `garantirUsuario()`**, que é o único lugar do
código que sabe que uma conta acabou de nascer — e a função roda em toda
requisição (pegadinha 12 do `CLAUDE.md`). O evento fica no ramo
`!documento.exists`; qualquer coisa fora dele viraria um evento por login.

**`livro_lido` sobe sob um `distinct_id` anônimo fixo** (`leitor-anonimo`), e só
para livro publicado — a prévia do dono sobre rascunho é trabalho de autor, não
leitura. Quem folheia não tem conta, e é para essa pessoa que o produto existe
(princípio 0.2). A contagem por livro continua certa pela propriedade `endereco`;
o que não existe é linha do tempo de leitor. O efeito colateral aceito é que
robô e pré-carregamento de link contam como abertura.

**A política de privacidade mudou junto.** `/privacidade` dizia "não usamos
analytics de terceiro", e passou a nomear o Visão de Produto entre os
provedores, com uma linha nova na tabela de dados do autor. Medir sem mudar o
texto deixaria o documento mentindo — e é documento legal, não copy de tela.

---

## Testes

`npm test` roda **145 testes** que não precisam de nada externo:

| Arquivo | O que garante |
|---|---|
| `tests/guardas.test.ts` | Cada rota devolve 401/403 sem sessão ou com sessão errada, e **nenhuma função do Firestore ou do Storage é chamada** nesses casos |
| `tests/isolamento-entre-contas.test.ts` | A conta A não lê, edita, publica nem exclui livro da conta B por rota nenhuma; livro inexistente e livro alheio dão a mesma resposta; o limite do plano é aplicado; a exclusão apaga o documento antes dos arquivos |
| `tests/visibilidade-publica.test.ts` | Rascunho devolve 404 para visitante, para outro autor e para o admin da plataforma; publicado é servido a qualquer um; o que sai do servidor não contém caminho do Storage, dono nem e-mail |
| `tests/regras-de-negocio.test.ts` | Slug, limites de plano, franquias, visibilidade e a chave do early adopter, como funções puras |
| `tests/visao.test.ts` | A instrumentação não envia nada sem chave, manda o prefixo do produto e a chave no cabeçalho quando tem, e **não lança quando a ponta recusa o evento ou está fora do ar** |
| `tests/app-ios.test.ts` | O token do app não pode ser forjado, adulterado, declarado sem assinatura nem sobreviver ao prazo; o bearer passa pela guarda com o mesmo rigor do cookie e **não cai na sessão da web quando é inválido**; livro alheio continua devolvendo 404 pelo bearer; e um JWS assinado por uma **cadeia de certificados forjada de verdade** — guardada em `tests/fixtures/` — é recusado |

`npm run test:emu` roda **31 testes de integração contra o emulador do Firebase**
(`npm run emu` primeiro). São eles que verificam o que mock nenhum verifica: que
a transação de handle realmente impede dois donos para o mesmo nome, que a
contagem por dono usa o índice certo, que apagar o livro apaga os arquivos, que a
conta do dono nasce e permanece ilimitada, e — o que prova o "vitalício" da regra
11.14 — que **desligar a chave não rebaixa quem já entrou e religá-la não promove
quem entrou depois**. Entraram aí as duas regras do app: conta criada pelo app
nasce gratuita com a chave ligada, conta que já existe não muda de plano ao entrar
pelo app, e assinatura expirada rebaixa o plano **sem despublicar o livro**. Sem o emulador no ar, esses testes
são pulados — `npm test` continua funcionando em qualquer máquina.

---

## Estado: no ar desde 10 de setembro de 2026

O Virapágina está em produção em **virapagina.app.br**, no projeto Firebase
`vira-pagina` e no deploy da Vercel a partir de `asiqueira1973/virapagina`.

O fluxo da seção 9 foi percorrido ponta a ponta com conteúdo real: conta criada
pelo login com Google, endereço público escolhido, PDF de 44 páginas e 9,2 MB
enviado, capa gerada da primeira página, livro publicado, lido no computador e
**num celular real**, e baixado com o título como nome do arquivo. Rascunho de
terceiro devolve 404 e nenhuma URL do Storage chega ao navegador.

O que foi feito na infraestrutura, e que a documentação anterior listava como
pendente: projeto Firebase criado no plano Blaze, CORS aplicado ao bucket,
OAuth Client criado, e regras e índices do Firestore e do Storage publicados.

### Seis defeitos que só apareceram em produção

Ficam registrados porque nenhum deles aparecia em build, teste ou emulador — e
os seis estão cobertos agora.

| Defeito | Por que passou | O que o impede de voltar |
|---|---|---|
| Variável de ambiente **vazia** derrubava o build (`new URL('')`) | `?? padrão` não protege de `''`, e importar um `.env.example` no painel de deploy cria exatamente variáveis vazias | `lib/env.ts` trata vazio como ausente; teste de regressão nas quatro leituras |
| **Laço de redirecionamento no primeiro login**: `/conta/handle` herdava o layout que mandava para `/conta/handle` | Só acontecia em conta sem handle — o caminho que exige OAuth real, impossível de exercitar localmente | A página vive num grupo de rota, fora de `app/conta/`; teste estrutural guarda o invariante |
| **Índices compostos ausentes** derrubavam o painel do autor | O Firestore só reclama em tempo de execução: o build passa, o teste com mock passa, e o emulador nem impõe índice | `scripts/diagnostico.mjs` roda as consultas reais contra o Firestore; o passo de publicar índices está em destaque no README |
| **Substituir o PDF não trocava o arquivo na tela**: o livro seguia exibindo o antigo | A URL de proxy é fixa e a resposta vinha com uma hora de cache e mais um dia de `stale-while-revalidate` — navegador e CDN não tinham por que perguntar de novo. Em teste nada disso existe, e em desenvolvimento o cache do Next mascara | `?v=<atualizado_em>` em toda URL de PDF e capa, `immutable` só quando versionada, `must-revalidate` + `ETag` quando não; seis testes em `visibilidade-publica.test.ts` |
| **Substituir o PDF escrevia numa pasta que ninguém lê** | `criarLivro()` sorteava o id do documento em vez de usar o da sessão de upload, então documento e pasta tinham ids diferentes. A substituição derivava o caminho do id do documento e acertava uma pasta vazia; a capa, gravada em `capa_caminho`, atualizava — o que fazia parecer que a troca tinha funcionado | O id vem da sessão de upload; a substituição escreve em `arquivo_pdf_caminho`, com `requireDonoDoLivro` guardando a escolha do caminho; seis testes em `isolamento-entre-contas.test.ts` |
| **A home vazava para fora da tela no celular** | A ilustração do hero tem duas páginas de 208px, e item de grid não encolhe abaixo do próprio conteúdo: os 416px esticavam a coluna e levavam o título junto. Só aparece abaixo de ~464px de viewport, largura que nenhum teste exercitava | A segunda página só existe a partir de 480px — página única abaixo, como o próprio leitor faz; `min-w-0` nos filhos do grid; dois testes estruturais em `regras-de-negocio.test.ts` |

---

## O que ainda depende do Alexandre

- **Agendar a rotina diária de tráfego** em Vercel → Settings → Cron Jobs:
  `POST /api/rotinas/avisar-trafego`, com `Authorization: Bearer <CRON_SECRET>`.
  É a válvula da regra 11.11 — sem ela, ninguém avisa antes de a fatura doer.
- **Conferir o alerta de orçamento** no Google Cloud. O Blaze não tem teto de
  gasto, e no v3 não há receita nenhuma para absorver surpresa.
- **Escolher um provedor de e-mail**, se quiser que os avisos de tráfego cheguem
  ao autor em vez de ficarem só no log e na tela de admin (divergência 6.5).
- **Cancelar o Heyzine** — era o teste original do produto inteiro.

Do app de iPhone. **O app foi submetido à App Review em 12/09/2026**, versão
1.0 (3), junto da assinatura mensal e do grupo dela. Feitos: o client OAuth do
tipo iOS, a variável `GOOGLE_OAUTH_IOS_CLIENT_ID` na Vercel, o produto
`app.br.virapagina.ilimitado.mensal` e a conta de revisão
`appsdablab@gmail.com`, com cinco livros publicados e plano gratuito — no
limite, para o revisor alcançar o paywall pelo caminho normal.

O que ainda falta:

- **Apontar as App Store Server Notifications V2** para
  `https://virapagina.app.br/api/app/assinatura/notificacoes`, nos dois
  ambientes, em App Store Connect → App Information. Isso **não** bloqueia a
  revisão e por isso é fácil de esquecer — mas sem elas, cancelamento, reembolso
  e falha de cobrança só seriam percebidos quando a pessoa abrisse o app, isto é,
  nunca: quem cancelou não abre. A conta ficaria `assinante` para sempre.
- **Recapturar as duas imagens do paywall** com o preço. Elas saíram com o botão
  escrito só "Assinar", porque o StoreKit local não carrega pelo `simctl`. Agora
  que o produto existe na App Store Connect, rodar pelo Xcode (⌘R) resolve. Entra
  na 1.1.
- **Decidir o que fazer se a App Review exigir Login com Apple** (pergunta aberta
  15.2 do `spec-ios.md`).
