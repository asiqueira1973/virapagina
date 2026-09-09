Crie as telas do produto **Virapágina**, uma plataforma onde qualquer pessoa sobe PDFs e recebe um link público para que sejam lidos em flipbook (efeito de virar página). Siga a especificação abaixo — não invente telas fora desta lista nem copy final além da listada.

Toda a copy marcada entre aspas é **texto final**, não placeholder: use literalmente.

---

## Direção visual

Já definida, mantenha:

- **Paleta neutra** — cinza, branco e quase-preto — com **um único tom de destaque**: azul `#1C5FD8` (hover `#12439B`), sobre fundo claro `#F5F5F6` e superfícies brancas.
- **Cor semântica separada da cor de marca.** Vermelho `#A32020` (fundo `#FDF2F2`, borda `#F3D2D2`) só para perigo e alerta. Verde `#1A7F4B` (fundo `#EAF6EF`) só para o selo "Publicado". Nunca use azul para status.
- **Tipografia:** Instrument Sans na interface; Instrument Serif nos títulos grandes das páginas públicas (home, vitrine).
- **Forma:** cantos arredondados suaves (8–16px), **hairlines** de 1px em vez de bordas pesadas, espaçamento generoso.
- Texto em pt-BR. Sem modo escuro, exceto o leitor, que é sempre escuro.

## Padrão de navegação — menu lateral estilo App Store Connect

As telas em `/conta/*` e `/admin/*` usam navegação lateral persistente:

- **Grupo** com título em negrito escuro, caixa normal — nunca MAIÚSCULAS decorativas.
- **Itens** indentados sob o grupo, **sem marcador nem bolinha**.
- **Hairline** fina separando os grupos.
- **Um item ativo por vez**, marcado com o azul de destaque: texto na cor + pílula clara da mesma cor ao fundo.
- **Rodapé** com o e-mail de quem está logado e o botão "Sair".

No painel do autor há um grupo: **"Livros"** (item: "Meus livros").
No painel da plataforma há um grupo: **"Plataforma"** (item: "Contas").

As telas públicas — home, termos, privacidade, login, vitrine e leitor — **não** usam navegação lateral. São páginas consumer, com cabeçalho simples.

---

## Fluxo principal entre telas

Da chegada ao primeiro livro publicado:

`/` (home) → "Começar de graça" → `/entrar` → login Google → `/conta/handle` (escolher endereço, **não pulável**) → `/conta/livros` → "Novo livro" → `/conta/livros/novo` (formulário + upload) → salva como rascunho → `/conta/livros/[id]` (edição, com prévia) → "Publicar" → o livro passa a aparecer em `/<handle>` (vitrine) e a responder em `/<handle>/<slug>` (leitor).

Do limite ao pedido de mais espaço:

`/conta/livros` com 5 de 5 livros → botão "Novo livro" desabilitado + aviso do limite → "Falar com a gente" → abre um e-mail. **Não há tela de planos nem de pagamento no v1** — quem libera mais livros é o dono da plataforma, pela tela de admin.

---

## Telas

### [Todos] Home — `/`

Mostra: o que o produto faz em uma frase grande em Instrument Serif, um exemplo de livro real folheável embutido na página, e o botão primário "Começar de graça". Abaixo, três blocos curtos com os diferenciais: sem marca d'água, nada do que você publica sai do ar, e o leitor não precisa de conta.
Cabeçalho simples com o nome do produto e o link "Entrar". **Sem menção a preço ou plano pago — eles não existem nesta versão.**
Sem navegação lateral.

### [Todos] Termos e Privacidade — `/termos` e `/privacidade`

Mostra: documento de texto longo, coluna estreita e legível, com índice lateral em telas largas. A página de termos termina com um bloco de **canal de denúncia** de conteúdo, com e-mail de contato em destaque.
Sem navegação lateral.

### [Visitante] Entrar — `/entrar`

Mostra: cartão centralizado com o nome do produto, título "Entrar" e um botão único **"Entrar com Google"** com a marca do Google. Uma linha explicando que a conta é criada automaticamente no primeiro acesso.
Estados: carregando durante o redirecionamento; erro genérico.
Sem navegação lateral (a pessoa ainda não está autenticada).

### [Autor sem handle] Escolher endereço — `/conta/handle`

Mostra: tela de passo único, sem navegação lateral, ocupando a página inteira — é o único momento em que o autor não tem para onde ir. Título explicando que este será o endereço público dele. Campo com prefixo fixo `virapagina.app.br/` e sugestão preenchida a partir do nome ou e-mail do Google, editável. Botão "Continuar".
Estados: verificando disponibilidade (indicador discreto no campo); disponível (marca de confirmação); formato inválido ("Use de 3 a 30 letras minúsculas, números ou hífen."); indisponível ("Esse endereço já está em uso, escolha outro." com um botão sugerindo uma alternativa livre).
Deixe visível o aviso de que o endereço **não pode ser alterado depois** — a troca é feita pelo suporte.

### [Todos] Vitrine do autor — `/<handle>`

Mostra: cabeçalho com o nome do autor em Instrument Serif e o endereço dele. Abaixo, grade de capas dos livros **publicados** daquele autor, cada card com capa, título, subtítulo e autor. Sem menu lateral.
Estados: vazio (mensagem simples, sem tom de erro: "Nenhum livro publicado ainda."); carregando (esqueleto de cards); autor inexistente (página 404 com "Esse endereço não existe." e link para a home).
**Rascunho não aparece aqui — nem para o próprio dono.** Não exiba o e-mail do autor.

### [Todos] Leitor — `/<handle>/<slug>`

Já implementado; desenhe apenas para referência visual. Fundo escuro ocupando a tela inteira. Cabeçalho com botão de voltar, título do livro e nome do autor. Visualizador central em flipbook: **página dupla em telas ≥1024px, página única abaixo**. Barra de ferramentas flutuante na base, em pílula escura translúcida, com: página anterior, indicador "12 de 44", próxima página, separador, diminuir zoom, percentual, aumentar zoom, separador, tela cheia, baixar, imprimir, compartilhar.
Estados: carregando (silhueta de página pulsando, nunca tela em branco); 404 ("Esse livro não está disponível." + link para a home); confirmação de cópia ("Link copiado.") em balão sobre a barra.
Interações a representar: clique e arrasto nas bordas da página, além dos botões de anterior/próxima sempre visíveis — nem todo leitor descobre o gesto sozinho.
O botão de tela cheia **some** onde o navegador não suporta; não desenhe estado desabilitado para ele.
Prévia do dono: quando o livro está em rascunho e quem vê é o dono, o subtítulo do cabeçalho ganha " · prévia de rascunho".

### [Autor] Meus livros — `/conta/livros`

Mostra: título "Livros", uma linha com o uso contra o limite ("3 de 5 livros"), e o botão "Novo livro" em destaque. Lista em cartão único com hairlines entre as linhas; cada linha traz miniatura da capa, título, o endereço `/<handle>/<slug>`, selo de status ("Publicado" em verde / "Rascunho" em cinza), data de atualização e a ação "Ver página pública" (só quando publicado).
Estados: vazio ("Nenhum livro ainda." com "Novo livro" centralizado em destaque); carregando (esqueleto de linhas); **limite atingido** (botão "Novo livro" desabilitado e um aviso: "Você chegou ao limite de {n} livros." com o botão "Falar com a gente", que abre um e-mail); livro removido por denúncia (linha com aviso em vermelho: "Este livro foi despublicado por violar os termos de uso. Fale com o suporte.").
Ações: só leitura e navegação — nada é editado nesta tela.
Navegação lateral: grupo "Livros", item "Meus livros" ativo.

### [Autor] Novo livro — `/conta/livros/novo`

Mostra: formulário com título, subtítulo (opcional), endereço do livro (campo com prefixo `/<handle>/` e slug sugerido do título, editável), autor (opcional, com o nome da conta como padrão), descrição (opcional), e área de upload de PDF por arrastar-e-soltar ou seleção, com barra de progresso.
Estados: validação inline do endereço ("Esse link já está em uso, escolha outro." com botão "Usar {sugestão}"); arquivo inválido ("Envie um arquivo PDF."); arquivo grande demais ("Arquivo muito grande (máximo 100 MB)."); progresso real em três etapas nomeadas (lendo o PDF e gerando a capa, enviando o arquivo, salvando o livro); erro de envio ("Não foi possível concluir o envio. Tente novamente.") **mantendo todos os campos preenchidos**.
Navegação lateral: grupo "Livros" ativo.

### [Autor dono] Editar livro — `/conta/livros/[id]`

Mostra: o mesmo formulário, preenchido, em duas colunas. À esquerda, os metadados com o botão "Salvar alterações", e abaixo, separadas por hairline, duas seções próprias: **"Substituir PDF"** (com sua própria área de upload e botão) e **"Excluir livro"** (em vermelho, com texto explicando que remove o arquivo e não há como desfazer). À direita, um painel com o selo de status, o botão "Publicar"/"Despublicar" que alterna conforme o estado, o botão "Ver como ficaria" (que abre o leitor mesmo em rascunho) e uma lista com páginas, tamanho, criado em e atualizado em.
Estados: confirmação nomeada ao excluir, em diálogo modal ("Excluir "{título}"? Essa ação não pode ser desfeita." com botões "Cancelar" e "Excluir" em vermelho); aviso ao trocar o endereço de um livro já publicado, também em modal ("Isso muda o link público. Quem tinha o link antigo vai receber página não encontrada. Continuar?"); sucesso discreto após salvar; livro removido por denúncia (botão "Publicar" desabilitado, com o aviso).
Navegação lateral: grupo "Livros" ativo.

### [Admin da plataforma] Contas — `/admin`

Mostra: uma faixa no topo com o estado da plataforma — **aberta ou fechada a early adopters** —, e abaixo a tabela densa de contas com e-mail, handle, plano, quantidade de livros contra o limite do plano, e tráfego do mês contra a franquia. Campo de busca por e-mail ou handle.
Enquanto a plataforma está aberta, toda conta nova nasce **early adopter**: livros ilimitados, para sempre. O selo do plano distingue três casos — plataforma (azul), early adopter (verde) e faixa comum (cinza).
Estados: aberta e fechada.
Estados: carregando (esqueleto de linhas); vazio; conta acima de 80% da franquia de tráfego destacada em alerta.
**Não mostre rascunho de ninguém.**
Navegação lateral: grupo "Plataforma", item "Contas" ativo.

### [Admin da plataforma] Detalhe da conta — `/admin/contas/[id]`

Mostra: dados da conta, uso de livros contra o limite, tráfego do mês, e as ações: alterar o plano da conta — com aviso quando ela é early adopter, porque isso é vitalício —, alterar handle, e a lista dos **livros publicados** daquela conta com a ação "Remover" em cada um. Abaixo, o registro das ações de admin já feitas sobre essa conta.
Estados: confirmação em modal para cada ação; a remoção pede um motivo curto.
Navegação lateral: grupo "Plataforma", item "Contas" ativo.

---

## Resumo de permissões por tela

| Tela | Visitante | Autor | Admin da plataforma |
|---|---|---|---|
| `/` Home, `/termos`, `/privacidade` | ✅ | ✅ | ✅ |
| `/entrar` | ✅ | (redireciona para `/conta/livros`) | ✅ |
| `/conta/handle` | ❌ | ✅ **obrigatória enquanto não tiver handle** | ✅ |
| `/<handle>` Vitrine | ✅ | ✅ | ✅ |
| `/<handle>/<slug>` Leitor, livro publicado | ✅ | ✅ | ✅ |
| `/<handle>/<slug>` Leitor, rascunho | ❌ (404) | ✅ **só o próprio** | ❌ (404) |
| `/conta/livros`, `/novo` | ❌ | ✅ **só os próprios** | ❌ |
| `/conta/livros/[id]` de outra pessoa | ❌ | ❌ (404) | ❌ |
| `/admin/*` | ❌ (404) | ❌ (404) | ✅ |

Toda rota `/conta/*` sem sessão redireciona para `/entrar`; represente esse redirecionamento no protótipo em vez de desenhar uma tela de "acesso negado". As rotas `/admin/*` devolvem **404** para quem não é admin da plataforma — nunca uma tela de acesso negado, que confirmaria que a rota existe.

---

## O que NÃO desenhar

Nada de cobrança. Não existe página de preços, tela de plano, formulário de dados fiscais, checkout, cartão de crédito nem tela de cancelamento nesta versão — e não é para deixar "preparado" ou "só a estrutura". O desenho dessas telas já está pronto no `EPICO-COBRANCA.md` e entra numa versão futura.
