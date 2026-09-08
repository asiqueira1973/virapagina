Crie as telas do produto **Virapágina**, uma plataforma de flipbooks (livros digitais em PDF com efeito de virar página). Siga a especificação abaixo — não invente telas fora desta lista nem copy final além da listada.

## Direção visual

Sem marca própria definida — proponha uma direção visual coerente com o produto, seguindo estas restrições:
- Paleta neutra (tons de cinza/branco/preto), com um único tom de destaque para botões primários e estado ativo (pode usar um azul, à sua escolha).
- Tipografia: sans-serif simples e legível (ex. Inter) — sem estilo manuscrito/hand-drawn (esse estilo pertence ao conteúdo dos livros, não à casca do produto).
- Cantos arredondados suaves, espaçamento generoso, hairlines em vez de bordas pesadas.

## Padrão de navegação do admin — menu lateral estilo App Store Connect

As telas em `/admin/*` usam navegação lateral persistente:
- Grupo em negrito escuro (ex. "Livros"), sem MAIÚSCULAS decorativas.
- Itens indentados sob o grupo, sem marcador/bolinha.
- Hairline fina separando grupos.
- Um item ativo por vez, marcado com a cor de destaque (texto na cor + leve pílula clara de fundo).
- Rodapé com e-mail do admin logado + botão "Sair".

As telas públicas (catálogo e leitor) **não** usam essa navegação lateral — são páginas simples, sem menu.

## Fluxo principal entre telas

Cadastro de um livro novo, do início ao fim:
`/admin/livros` (lista) → botão "Novo livro" → `/admin/livros/novo` (formulário + upload) → salva como rascunho → `/admin/livros/[id]` (edição, com prévia) → botão "Publicar" → livro passa a aparecer em `/` (catálogo) e responde em `/l/[slug]` (leitor público).

## Telas

### [Admin] Login — `/admin/login`
Mostra: campo e-mail, campo senha, botão "Entrar", link "Esqueci minha senha".
Estados: erro de credencial ("E-mail ou senha incorretos."), confirmação de recuperação de senha ("Se esse e-mail existir, enviamos um link."), carregando durante o submit.
Sem navegação lateral (usuário ainda não autenticado).

### [Admin] Lista de livros — `/admin/livros`
Mostra: tabela ou grade de todos os livros (publicados e rascunho), com miniatura da capa, título, badge de status ("Publicado" em verde / "Rascunho" em cinza), data de atualização, e ação "Ver página pública" (só quando publicado). Botão "Novo livro" em destaque no topo.
Estados: vazio ("Nenhum livro ainda." + botão "Novo livro" centralizado), carregando (skeleton de linhas/cards).
Ações: apenas leitura + navegação para criar/editar — nada é editado direto nesta tela.
Navegação lateral: grupo "Livros" ativo.

### [Admin] Novo livro — `/admin/livros/novo`
Mostra: formulário com título, subtítulo (opcional), slug (sugerido automaticamente, editável), descrição (opcional), campo de upload de PDF (arrastar-e-soltar ou selecionar arquivo) com barra de progresso.
Estados: validação inline (slug duplicado, arquivo não-PDF, arquivo acima de 100 MB), progresso de upload real, erro de envio ("Não foi possível concluir o envio. Tente novamente." — mantendo os campos preenchidos).
Navegação lateral: grupo "Livros" ativo.

### [Admin] Editar livro — `/admin/livros/[id]`
Mostra: mesmo formulário da criação, preenchido, mais: prévia do livro (abre o leitor mesmo se despublicado), botão "Publicar"/"Despublicar" (alterna conforme o estado atual), botão "Substituir PDF" (ação separada do formulário de metadados), botão "Excluir" (perigo, cor de alerta).
Estados: confirmação nomeada ao excluir ("Excluir "{título}"? Essa ação não pode ser desfeita."), aviso ao trocar slug de livro já publicado ("Isso muda o link público... Continuar?").
Navegação lateral: grupo "Livros" ativo.

### [Visitante/Admin] Catálogo — `/`
Mostra: grade de capas dos livros publicados, cada card com capa, título, subtítulo, autor. Sem navegação lateral — cabeçalho simples (logo/nome do produto, se houver).
Estados: vazio (mensagem simples, sem tom de erro), carregando (skeleton de cards).
Permissões: mesma tela para visitante e admin — não há diferença de conteúdo (o catálogo só lista livros publicados para todo mundo, inclusive admin logado).

### [Visitante/Admin] Leitor — `/l/[slug]`
Mostra: cabeçalho com título e autor do livro; visualizador central em efeito flipbook (página dupla em telas ≥1024px, página única abaixo disso); barra de ferramentas com: zoom (-/+), tela cheia, baixar, imprimir, compartilhar; indicador de página atual/total.
Estados: carregando (enquanto o PDF renderiza a primeira página), 404 ("Esse livro não está disponível." + link para o catálogo) quando o slug não existe ou o livro está despublicado para um visitante.
Permissões: idêntico para visitante e admin, exceto que o admin também acessa esta URL para livros despublicados (usado como prévia a partir da tela de edição) — visitante recebe 404 nesse caso.
Interações a desenhar: clique/arrasto nas bordas da página, botões de navegação anterior/próxima como fallback visível (nem todo visitante vai descobrir o gesto de arrastar sozinho).

## Resumo de permissões por tela

| Tela | Visitante | Admin |
|---|---|---|
| `/` Catálogo | ✅ | ✅ |
| `/l/[slug]` Leitor (publicado) | ✅ | ✅ |
| `/l/[slug]` Leitor (rascunho) | ❌ (404) | ✅ (prévia) |
| `/admin/login` | ❌ (não se aplica) | ✅ |
| `/admin/livros` | ❌ | ✅ |
| `/admin/livros/novo` | ❌ | ✅ |
| `/admin/livros/[id]` | ❌ | ✅ |

Toda rota `/admin/*` sem sessão válida redireciona para `/admin/login` — represente esse redirecionamento no protótipo em vez de desenhar um estado de "acesso negado".
