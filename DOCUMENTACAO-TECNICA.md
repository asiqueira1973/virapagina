# Documentação técnica — Virapágina

Escrito a partir do que está implementado, não do que foi planejado. Cobre os
seis itens exigidos pela seção 19 do `spec.md`. Se alguma coisa aqui não bater
com o código, o código está certo e este documento está velho — corrija-o no
mesmo commit da mudança.

Versão do spec implementada: **2.0** (Google Sheets + Google Drive, sem banco
relacional).

---

## 1. A planilha `livros`, em linguagem de negócio

Não existe banco de dados. Os dados de todos os livros vivem numa única planilha
do Google Sheets, na conta do Alexandre, numa aba chamada **`livros`**. A linha 1
é o cabeçalho; cada linha a partir da 2 é um livro.

| Coluna | Nome | O que significa na prática |
|---|---|---|
| A | `id` | Identificador interno do livro. Gerado pela aplicação (`crypto.randomUUID()`) quando o livro é criado — a planilha não gera nada sozinha. É o que a URL do painel usa (`/admin/livros/<id>`). Nunca aparece para o leitor. |
| B | `titulo` | O nome do livro. Aparece no catálogo, no cabeçalho do leitor, na aba do navegador e como nome do arquivo quando alguém baixa o PDF. |
| C | `subtitulo` | Opcional. Vazio quando o livro não tem. Aparece no card do catálogo. |
| D | `slug` | O endereço público: `virapagina.app.br/l/<slug>`. Só letras minúsculas, números e hífen. **É único, mas quem garante isso é o código, não a planilha** — a aplicação lê todas as linhas antes de gravar e recusa duplicata. |
| E | `autor` | Quem assina o livro. Fica `Alexandre Siqueira` quando o campo é deixado em branco no formulário. |
| F | `descricao` | Opcional. Texto curto usado no card de compartilhamento (o que aparece quando o link é colado no LinkedIn ou no WhatsApp). |
| G | `arquivo_pdf_drive_id` | O identificador do arquivo PDF dentro da pasta do Drive. **Nunca sai do servidor**: o leitor recebe o PDF por uma rota de proxy nossa, nunca um link do Drive. |
| H | `arquivo_pdf_tamanho_bytes` | Tamanho do arquivo, para conferência no painel. Pode ficar vazio se a leitura falhar — isso não impede publicar. |
| I | `capa_drive_id` | Identificador da imagem de capa no Drive. Vazio até a capa ser gerada. Também nunca sai do servidor. |
| J | `total_paginas` | Quantas páginas o PDF tem. Lido no navegador no momento do upload. Pode ficar vazio — também não impede publicar. |
| K | `publicado` | Só dois valores: `sim` ou `nao`. É o que decide se o livro aparece no catálogo e se a URL pública responde. Qualquer valor diferente de `sim` é tratado como `nao`, para que uma célula digitada errado nunca publique um rascunho por acidente. |
| L | `criado_por` | E-mail de quem criou a linha, vindo da sessão do Google. |
| M | `criado_em` | Data e hora da criação, em ISO 8601. É por este campo que o catálogo ordena, do mais recente para o mais antigo. |
| N | `atualizado_em` | Data e hora da última alteração. **Não existe trigger de banco**: é a rota de API que reescreve este campo em toda gravação. |

**Exclusão é definitiva.** Excluir um livro apaga a linha da planilha e depois os
arquivos do Drive — nessa ordem, para nunca sobrar metadado apontando para
arquivo que não existe mais. Não há lixeira.

**Concorrência não é tratada.** Dois admins editando a mesma linha ao mesmo tempo
resultam em "o último que gravar vence". Aceitável porque há, na prática, um
único admin.

### Como o código conversa com a planilha

Todo o conhecimento do formato está em [`lib/google/sheets.ts`](lib/google/sheets.ts).
Nenhum outro arquivo sabe que existe uma planilha. Se um dia isso virar Postgres,
é esse arquivo que muda.

Duas armadilhas registradas no próprio código:

- **A planilha é posicional.** Uma célula a mais ou a menos numa gravação desloca
  todos os campos da linha em silêncio. Por isso `livroToRow` confere a
  quantidade de células contra a lista de colunas e lança erro se não bater.
- **A Sheets API não apaga "a linha do id X".** É preciso localizar o índice da
  linha e pedir um `deleteDimension` por posição — o que a função `deleteBookRow`
  faz.

---

## 2. Como a autorização funciona sem banco

Não há RLS. Não há tabela de administradores. Toda a segurança do produto está em
duas peças de código, e é por isso que elas têm teste automatizado dedicado.

### A allowlist

Quem é admin é definido inteiramente pela variável de ambiente
`ADMIN_ALLOWED_EMAILS`, uma lista de e-mails separados por vírgula. Não existe
tela de cadastro nem convite. Adicionar um admin é editar essa variável na Vercel.

A função `isAdminEmail()` em [`lib/google/config.ts`](lib/google/config.ts)
normaliza para minúsculas e ignora espaços, para que um espaço a mais na Vercel
não tranque o Alexandre fora do próprio painel.

### O login

Login é só com Google, via Auth.js. Qualquer pessoa pode *tentar* logar — o
Google não bloqueia isso. O que bloqueia é o callback `signIn` em
[`lib/google/auth.ts`](lib/google/auth.ts): se o e-mail não está na allowlist, ele
devolve a pessoa para `/admin/login?erro=sem-acesso`, e **nenhuma sessão é
criada**. A tela mostra "Esse e-mail não tem acesso ao painel."

A sessão é um cookie JWT (não há banco onde guardar sessão), com validade de 30
dias e renovação silenciosa.

### As três camadas de checagem

1. **`middleware.ts`** — barra qualquer `/admin/*` sem sessão válida e redireciona
   para `/admin/login`. É a primeira barreira, não a única.
2. **`app/admin/livros/layout.tsx`** — confere a sessão de novo antes de renderizar
   qualquer tela do painel. Confiar só no middleware seria a mesma armadilha de
   confiar só no frontend.
3. **`requireAdmin()`** — a guarda que toda rota `/api/admin/*` chama **como
   primeira linha**, antes de qualquer leitura ou escrita no Sheets ou no Drive.
   Devolve `401` quando não há sessão e `403` quando há sessão mas o e-mail não
   está na allowlist.

Para as rotas públicas existe a irmã `isAdminRequest()`, que não devolve erro: só
diz se quem está pedindo é admin. É ela que libera a prévia de rascunho para o
Alexandre mantendo o 404 para o visitante.

### O que os testes garantem

`npm test` roda 44 testes. Os que importam para esta seção:

- Para **cada uma das oito rotas** sob `/api/admin/*`: sem sessão devolve 401,
  com e-mail fora da allowlist devolve 403 e, nos dois casos, **nenhuma função do
  Sheets ou do Drive chega a ser chamada**. Os módulos do Google são substituídos
  por espiões e o teste falha se qualquer um deles for tocado.
- `GET /api/livros/[slug]`, `/pdf` e `/capa` devolvem 404 para livro em rascunho
  quando não há sessão de admin, e o Drive não é acessado.
- O que sai do servidor para o público não contém os ids de arquivo do Drive nem
  o e-mail de quem criou o livro.

Esse teste não é opcional. Sem banco relacional, ele é a única rede de segurança
que existe.

---

## 3. Rotas de API e o que cada uma valida

Toda leitura e escrita no Google acontece no servidor. O navegador nunca fala com
a API do Google — a única exceção é o envio dos bytes do PDF, explicada na seção
de divergências.

### Públicas

| Rota | O que faz | O que valida antes de agir |
|---|---|---|
| `GET /api/livros` | Lista do catálogo | Filtra `publicado = "sim"` e ordena por `criado_em` decrescente. Rascunho não sai por aqui nem para o admin. Cache de 60s. |
| `GET /api/livros/[slug]` | Metadados de um livro | Livro existe? Está publicado — ou quem pede é admin? Se não, 404. A prévia do admin nunca vem do cache. |
| `GET /api/livros/[slug]/pdf` | Transmite o PDF do Drive | Mesma checagem de visibilidade, mais: o livro tem `arquivo_pdf_drive_id`? Com `?download=1`, acrescenta `Content-Disposition` com o título como nome do arquivo. Rascunho recebe `Cache-Control: private, no-store`. |
| `GET /api/livros/[slug]/capa` | Transmite a capa do Drive | Mesma checagem, mais: o livro tem `capa_drive_id`? Sem capa, 404. |

### Admin — todas chamam `requireAdmin()` na primeira linha

| Rota | O que faz | O que valida antes de agir |
|---|---|---|
| `POST /api/admin/livros` | Cria o livro, sempre como rascunho | Título preenchido; `arquivo_pdf_drive_id` presente (o PDF já subiu); slug em formato válido; **slug livre** — se não estiver, devolve 409 com a mensagem e uma sugestão (`-2`, `-3`…). Se a gravação na planilha falhar depois de a capa ter subido, a capa é apagada para não virar arquivo órfão. |
| `PUT /api/admin/livros/[id]` | Atualiza metadados | Livro existe; título preenchido; slug válido; se o slug mudou, revalida unicidade ignorando o próprio livro. Não toca no PDF. Reescreve `atualizado_em`. |
| `DELETE /api/admin/livros/[id]` | Exclui em definitivo | Livro existe. Apaga **primeiro** a linha da planilha, **depois** os arquivos do Drive. Falha ao apagar arquivo vira log de arquivo órfão, não exclusão pela metade. |
| `POST /api/admin/livros/[id]/publicar` | `publicado = "sim"` | Livro existe. |
| `POST /api/admin/livros/[id]/despublicar` | `publicado = "nao"` | Livro existe. Não apaga nada. |
| `POST /api/admin/livros/[id]/substituir-pdf` | Troca o arquivo | Livro existe; novo `arquivo_pdf_drive_id` presente. Recalcula tamanho e total de páginas, regenera a capa, e só então apaga o PDF e a capa antigos. |
| `POST /api/admin/livros/sessao-upload` | Abre a sessão de upload no Drive | Nome preenchido; tipo é `application/pdf`; tamanho é número positivo e **não passa de 100 MB**. Rota adicional — ver divergências. |
| `GET /api/admin/livros/slug-disponivel` | Diz se um slug está livre | Slug preenchido e em formato válido. Devolve `disponivel` e, quando ocupado, a `sugestao`. Rota adicional — ver divergências. |

Toda rota, pública ou de admin, captura falha de integração com o Google,
registra o erro real no log de servidor e devolve ao usuário apenas
"Algo deu errado. Tente novamente em instantes." Detalhe técnico da API do Google
nunca aparece na tela.

### Cache

As leituras públicas passam por `readAllBooksCached`, com `revalidate: 60` e a
etiqueta `livros`. Toda rota de admin que escreve chama `revalidateTag('livros')`,
então uma publicação aparece no catálogo na hora, sem esperar o minuto.

---

## 4. Mapa tela → rotas de API

| Tela | Como lê | Como escreve |
|---|---|---|
| `/` — Catálogo | Componente de servidor, direto em `readAllBooksCached()` | — |
| `/l/[slug]` — Leitor | Componente de servidor para os metadados; navegador em `GET /api/livros/[slug]/pdf` para o arquivo e `/capa` para a imagem do card | — |
| `/admin/login` | — | Auth.js em `/api/auth/*` |
| `/admin/livros` | Componente de servidor, direto em `readAllBooks()` (sem cache) | — |
| `/admin/livros/novo` | `GET /api/admin/livros/slug-disponivel` | `POST /api/admin/livros/sessao-upload` → envio direto ao Drive → `POST /api/admin/livros` |
| `/admin/livros/[id]` | Componente de servidor, direto em `findBookById()` | `PUT` e `DELETE /api/admin/livros/[id]`, `/publicar`, `/despublicar`, `/substituir-pdf` |

As telas do admin **leem** em componente de servidor e **escrevem** por rota de
API. Ler direto continua sendo servidor — a credencial não vai ao navegador — e
evita uma ida e volta HTTP para renderizar a própria página.

---

## 5. Lógica das principais funcionalidades, por tela

### `/admin/login`
Botão único "Entrar com Google". Quem já está logado e autorizado é mandado
direto para `/admin/livros`. O parâmetro `?erro=sem-acesso` na URL — colocado
pelo callback do Auth.js quando o e-mail não está na allowlist — mostra o aviso.
"Sair" encerra a sessão e volta para a home pública.

### `/admin/livros`
Lista tudo, publicado e rascunho, do mais recente para o mais antigo: miniatura
da capa, título, o slug, selo de status, data de atualização e o link "Ver página
pública", que só aparece quando o livro está publicado. Sem nenhum livro, mostra
"Nenhum livro ainda." com o botão em destaque. Enquanto a planilha é lida, um
esqueleto de linhas ocupa o lugar.

### `/admin/livros/novo`
A ordem das etapas foi escolhida para não deixar lixo no Drive:

1. O slug é sugerido em kebab-case a partir do título e para de acompanhá-lo
   assim que o admin edita o campo à mão.
2. O arquivo escolhido é validado **no navegador**: precisa ser PDF e não pode
   passar de 100 MB.
3. No envio, o slug é conferido no servidor **antes** de o arquivo subir. Ocupado,
   mostra a mensagem e o botão "Usar &lt;sugestão&gt;".
4. O PDF é lido no navegador para extrair o total de páginas e desenhar a primeira
   página como capa PNG.
5. O arquivo sobe para o Drive com barra de progresso real, alimentada pelos
   eventos do XHR — não é animação.
6. Só depois de o upload terminar é que a linha entra na planilha, como rascunho.
7. Falhou? A mensagem aparece, **os campos preenchidos permanecem** e o id do
   arquivo já enviado é guardado, para que tentar de novo não reenvie o PDF.

### `/admin/livros/[id]`
Quatro ações que o spec trata como separadas, e que continuam separadas na tela:

- **Salvar alterações** grava só os metadados; nunca pede o PDF de novo. Se o
  livro está publicado e o slug mudou, um diálogo avisa que o link antigo vai
  quebrar e exige confirmação.
- **Publicar / Despublicar** alterna o único par de estados que existe.
  Despublicar não apaga nada.
- **Substituir PDF** sobe um arquivo novo, recalcula tamanho e páginas, regenera
  a capa e só então apaga os arquivos antigos.
- **Excluir** abre um diálogo que **nomeia o livro** antes de confirmar.

O painel lateral traz o status, o botão de publicação, o link de prévia
("Ver como ficaria" enquanto é rascunho) e os números do arquivo.

### `/l/[slug]` — o leitor
É o produto inteiro numa tela. O PDF original é buscado na rota de proxy e
renderizado página a página em `<canvas>` pelo PDF.js, dentro do `react-pageflip`,
que cuida da animação de virar. O PDF nunca vira imagem no servidor.

- **Página dupla** acima de 1024px de largura, **única** abaixo.
- **Virar** funciona por clique na borda, arrasto, swipe e setas do teclado. Os
  botões de anterior e próxima ficam sempre visíveis na barra, porque nem todo
  leitor descobre o gesto sozinho.
- **Zoom** de 75% a 250%, em passos de 25%, começando em 100%. Mudar o zoom
  remonta o flipbook — ele mede o tamanho na inicialização — e o `startPage`
  devolve o leitor para a página em que estava, então o zoom persiste ao virar.
- **Só as páginas próximas da atual são desenhadas** (três para cada lado).
  Desenhar as 44 de uma vez trava o celular.
- **Tela cheia** usa a Fullscreen API; onde ela não existe (iOS Safari, por
  exemplo), o botão simplesmente não aparece.
- **Baixar** e **imprimir** apontam para a rota de proxy — a URL do Drive nunca
  chega ao navegador. Baixar acrescenta `?download=1`, que serve o arquivo com o
  título do livro como nome.
- **Compartilhar** abre o menu nativo do sistema onde a Web Share API existe; onde
  não existe, copia o link e mostra "Link copiado."
- Todos os botões têm `aria-label` além do ícone.

Três defeitos foram encontrados testando com um PDF real de 40 páginas, e as
soluções estão comentadas no código porque nenhuma delas é óbvia:

1. **O PDF.js recusa dois desenhos simultâneos no mesmo canvas** e só o libera
   quando o anterior termina — cancelar não basta, é preciso esperar. Os desenhos
   de cada página são enfileirados.
2. **A página ficava desenhada mas invisível**: o `setDesenhada` estava
   condicionado a um sinalizador de cancelamento que um efeito posterior marcava
   *depois* de a página já ter sido pintada.
3. **Medir o container só na montagem deixava o leitor em branco para sempre**
   numa aba aberta em segundo plano, onde o Chrome zera o layout. A medição passou
   a ser feita por `ResizeObserver`.

### `/` — catálogo
Grade com capa, título, subtítulo e autor, do mais recente para o mais antigo, só
de livros publicados. É a mesma tela para visitante e admin. Catálogo vazio e
falha de integração com o Google são estados **diferentes**, com mensagens
diferentes.

---

## 6. Divergências em relação ao spec

### 6.1 O upload não passa pela rota de API (aprovado pelo Alexandre)

**O spec diz** (seção 4): "o admin seleciona o arquivo no navegador, que envia pro
servidor (rota de API), que sobe pro Drive".

**O que foi feito:** a rota de servidor autentica com a conta de serviço e abre uma
*sessão de upload resumável* no Drive; o navegador envia os bytes direto para o
endereço temporário dessa sessão.

**Por quê:** funções serverless da Vercel aceitam no máximo ~4,5 MB de corpo de
requisição. Do jeito escrito, qualquer PDF acima disso falharia em produção —
inclusive o livro de ~9 MB que motivou o produto — e a regra 11.2 (até 100 MB)
seria impossível de cumprir. A credencial da conta de serviço continua sem sair do
servidor: o navegador recebe apenas uma URL de sessão válida para aquele upload.
A barra de progresso, que precisa ser real (critério 8.2), passou a ser possível.

### 6.2 Duas rotas de API a mais que a lista da seção 13

- `POST /api/admin/livros/sessao-upload` — consequência direta da decisão acima.
- `GET /api/admin/livros/slug-disponivel` — antecipa para o formulário a mesma
  checagem de unicidade que o `POST` continua fazendo no servidor. Sem ela, o
  admin subiria um PDF de dezenas de megabytes para só então descobrir que o link
  já está em uso, e o arquivo ficaria órfão no Drive. O critério 8.2 continua
  cumprido: a rejeição definitiva é a do servidor, no momento da gravação.

### 6.3 As telas do admin leem em componente de servidor, não por rota de API

A seção 13 enumera, para o admin, só rotas de escrita. As leituras
(`/admin/livros` e `/admin/livros/[id]`) são feitas em componente de servidor,
chamando `lib/google/sheets.ts` direto. Continua sendo servidor — o princípio 0.3
está preservado — e evita uma ida e volta HTTP para a página renderizar a si
mesma.

### 6.4 Substituir o PDF regenera a capa

O critério 8.2 diz que substituir o PDF recalcula `total_paginas` e
`arquivo_pdf_tamanho_bytes`, e não menciona a capa. Como a regra 11.1 define a
capa como sendo a primeira página do PDF, manter a capa antiga sobre um arquivo
novo deixaria a vitrine mostrando conteúdo que não está mais lá. A capa é
regenerada junto.

### 6.5 O formulário tem campo "Autor"

A seção 7 diz que `autor` fica `Alexandre Siqueira` "se deixado em branco", o que
pressupõe um campo. O formulário de criação e edição tem esse campo, opcional,
com o valor padrão aplicado no servidor quando vazio.

### 6.6 Catálogo e leitor separam "não existe" de "o Google falhou"

Os critérios 8.3 e 8.5 preveem, para essas telas, o 404 e o estado vazio. Quando a
planilha está inacessível, nenhuma das duas mensagens é verdadeira: dizer "esse
livro não está disponível" ou "nenhum livro publicado ainda" durante uma queda de
integração mandaria o Alexandre procurar o problema no lugar errado. As duas telas
mostram, nesse caso, a mensagem genérica da seção 14–15
("Algo deu errado. Tente novamente em instantes."), que já existia na copy.

### 6.7 `publicado` é `'sim' | 'nao'` também no TypeScript

A seção 7 fixa as strings `"sim"`/`"nao"` na planilha. O tipo TypeScript espelha
isso literalmente em vez de converter para booleano na fronteira, para que o
código e a planilha digam a mesma coisa e não exista um ponto de conversão onde
enganar-se seja possível. Qualquer valor diferente de `sim` é lido como `nao`.

### 6.8 Menu lateral com um grupo só

A seção 16 pede "grupo único 'Livros' no MVP". O canvas de design
(`Vira Pagina design/Virapagina.dc.html`) trazia um segundo grupo, "Site", com o
item "Ver catálogo". Seguimos o spec, que é a fonte de verdade: existe um grupo
só. O canvas foi seguido em tudo o mais — paleta, tipografia, espaçamento.

### 6.9 A tela de login do canvas de design está desatualizada

O canvas foi desenhado para a v1.0 do spec, que tinha login por e-mail e senha. A
v2.0 substituiu isso por Google OAuth. A tela mantém a estrutura visual do canvas,
com um botão único "Entrar com Google" no lugar dos dois campos.

### 6.10 Aviso conhecido no build

O `next build` emite um aviso vindo de `node_modules/jose` (dependência do
Auth.js): `CompressionStream` não seria suportado no Edge Runtime. É um falso
positivo da análise estática do Next — a API existe no Edge Runtime da Vercel e o
middleware funciona. O aviso não vem de código nosso e foi deixado como está.

---

## O que ainda falta, e não dá para fazer sem o Alexandre

Estes itens do Definition of Done (seção 26) dependem de credenciais ou de
hardware que só o Alexandre tem:

- **Configurar o Google Cloud** (seção 27, passo 2): projeto, Sheets API, Drive
  API, conta de serviço com chave JSON, e o OAuth Client ID. O passo a passo está
  no `README.md`.
- **Compartilhar a planilha e a pasta com a conta de serviço.** Sem isso, nada
  funciona — é a causa mais provável de "Algo deu errado" logo no primeiro uso.
- **Teste ponta a ponta real** do fluxo da seção 9: upload → publicação → leitura
  → download → compartilhar.
- **Teste num iPhone e num Android reais** (seção 22), para validar swipe e
  Fullscreen API. Emulador não basta.
- **Publicar o livro de tecnologia** como primeiro título real.
- **Risco a observar no primeiro upload:** contas de serviço não têm cota de
  armazenamento própria no Google Drive. Enviar para uma pasta compartilhada por
  uma conta pessoal costuma funcionar, mas se aparecer o erro
  "Service Accounts do not have storage quota", a saída é trocar a autenticação do
  Drive por um *refresh token* OAuth da conta do próprio Alexandre — mudança
  contida em `lib/google/drive.ts`, sem impacto nas telas.
