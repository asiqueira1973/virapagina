# Documentação técnica — Virapágina

Escrito a partir do que está implementado, não do que foi planejado. Cobre os
seis itens exigidos pela seção 19 do `spec.md`. Se alguma coisa aqui não bater
com o código, o código está certo e este documento está velho — corrija-o no
mesmo commit.

**Versão implementada: 3.0** — produto multi-tenant sobre Firestore e Cloud
Storage, **sem cobrança**. O desenho da cobrança está pronto em
`EPICO-COBRANCA.md` e não foi implementado: não há Stripe, tela de preços, campo
de assinatura nem coleta de dado fiscal em lugar nenhum do código.

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
| `plano` | A faixa de limite de livros. Um de: `gratuito`, `ate_20`, `ate_50`, `ate_100`, `ilimitado` |
| `trafego_mes_bytes` | Quantos bytes de PDF e capa foram servidos para os livros desta conta no mês corrente |
| `trafego_mes_referencia` | O mês do contador, em `AAAA-MM`. Quando não bate com o mês de hoje, o contador recomeça do zero |
| `criado_em`, `atualizado_em` | Datas. `atualizado_em` é reescrito pela aplicação em toda gravação — **não existe trigger** |

**O que cada plano dá** (`lib/planos.ts` é a única fonte desses números):

| Plano | Limite de livros | Franquia de tráfego | Como se chega nele |
|---|---|---|---|
| `gratuito` | 5 | 20 GB/mês | Padrão de toda conta nova |
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

### A regra que se reaplica sozinha

`garantirUsuario()` roda em **todo** login e em toda entrada no painel. Além de
criar a conta no primeiro acesso, ela reaplica a regra 11.13: e-mail em
`ADMIN_ALLOWED_EMAILS` tem `plano = ilimitado`, sempre. Se um e-mail for
acrescentado à variável depois, a conta se conserta no próximo login, sem passo
manual. Se alguém rebaixar a conta à mão no console, o próximo login desfaz.

A função só grava quando algo mudou de verdade — login não gera escrita à toa.

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
| `/admin/contas` | `usuarios`, `livros` (servidor) | — |
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

### 6.10 O contador de tráfego é aproximado

O Firestore tolera cerca de uma escrita por segundo no mesmo documento. Um livro
viral gera mais leituras do que isso, e parte da contagem se perde. Para uma
válvula que existe para **gerar conversa** — não corte nem cobrança —, contagem
aproximada basta. A alternativa (agregação em outra coleção, somada por rotina)
custaria mais do que o problema.

---

## Testes

`npm test` roda **80 testes** que não precisam de nada externo:

| Arquivo | O que garante |
|---|---|
| `tests/guardas.test.ts` | Cada rota devolve 401/403 sem sessão ou com sessão errada, e **nenhuma função do Firestore ou do Storage é chamada** nesses casos |
| `tests/isolamento-entre-contas.test.ts` | A conta A não lê, edita, publica nem exclui livro da conta B por rota nenhuma; livro inexistente e livro alheio dão a mesma resposta; o limite do plano é aplicado; a exclusão apaga o documento antes dos arquivos |
| `tests/visibilidade-publica.test.ts` | Rascunho devolve 404 para visitante, para outro autor e para o admin da plataforma; publicado é servido a qualquer um; o que sai do servidor não contém caminho do Storage, dono nem e-mail |
| `tests/regras-de-negocio.test.ts` | Slug, limites de plano, franquias e visibilidade, como funções puras |

`npm run test:emu` roda **19 testes de integração contra o emulador do Firebase**
(`npm run emu` primeiro). São eles que verificam o que mock nenhum verifica: que
a transação de handle realmente impede dois donos para o mesmo nome, que a
contagem por dono usa o índice certo, que apagar o livro apaga os arquivos, e que
a conta do dono nasce e permanece ilimitada. Sem o emulador no ar, esses testes
são pulados — `npm test` continua funcionando em qualquer máquina.

---

## O que ainda depende do Alexandre

- **Criar o projeto no Firebase** (novo e dedicado, decisão 25.1), ativar
  Firestore e Storage, subir para o plano **Blaze** e **configurar o alerta de
  orçamento** — o Blaze não tem teto de gasto, e no v3 não há receita nenhuma
  para absorver surpresa.
- **Configurar o CORS do bucket** com o `cors.json` da raiz. Sem isso, todo
  upload falha no navegador e o servidor não tem como saber.
- **Criar o OAuth Client ID** do Google para o login.
- **Publicar as regras** do Firestore e do Storage (`firebase deploy --only
  firestore:rules,storage`) e os índices compostos.
- **Escolher um provedor de e-mail**, se quiser os avisos da divergência 6.5.
- **Testar o leitor num iPhone e num Android reais** — emulador não valida swipe
  nem Fullscreen API.
