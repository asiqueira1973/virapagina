---
Documento: spec-ios.md — Virapágina para iPhone
Versão: 1.0
Responsável de produto: Alexandre Siqueira
Status: aprovado para implementação
Data: 2026-09-12
---

# Virapágina iOS — Especificação de Software (SDD)

## Como usar este documento

Este documento é o **delta** do `spec.md` para o aplicativo nativo de iPhone. Ele
não substitui o spec da plataforma: tudo que não estiver aqui continua valendo
exatamente como está lá — mesmo Firestore, mesmo Storage, mesmas guardas, mesma
copy, mesmas URLs públicas.

Onde este documento e o `spec.md` divergirem, **este vence para o app** e a
divergência está declarada na seção 14.

As regras deste documento são citadas no código como `regra iOS 10.x`, para não
colidirem com as `regra 11.x` da plataforma.

### Por que um app nativo

Três coisas que o site não consegue fazer e que decidem este produto:

1. **Cobrar.** O site não tem cobrança e não terá tão cedo (`EPICO-COBRANCA.md`).
   A App Store tem esteira de assinatura pronta, com nota fiscal, cancelamento,
   reembolso e cobrança recorrente — sem Stripe, sem dados fiscais, sem webhook
   de pagamento escrito por nós.
2. **Estar no bolso.** O autor que fotografa o PDF no Files, sobe e manda o link
   pelo WhatsApp no mesmo minuto.
3. **Ser encontrado.** A App Store é um canal de distribuição; o site não é.

### O que o app **não** é

Não é um leitor de livros de terceiros, não é vitrine de catálogo e não é um
navegador embutido do site. É a **ferramenta do autor**: entra, sobe, publica,
compartilha. Quem lê continua lendo no navegador, sem conta e sem app (princípio
0.2 do `spec.md`).

---

## 0. Princípios não-negociáveis

Herdados do `spec.md`, todos, sem exceção. Três acrescentados:

8. **O app é cliente do mesmo backend.** Nenhuma regra de negócio é reimplementada
   em Swift. Limite de livros, unicidade de handle, unicidade de slug, publicação
   e exclusão continuam decididos pelas rotas do Next.js, com as mesmas guardas.
   O app desenha e pede; ele nunca decide.
9. **O app nunca fala com o Firestore nem com o Storage.** Vale a mesma regra do
   navegador (princípio 0.3). A única exceção é a URL temporária da sessão de
   upload, que o servidor emite para aquele arquivo específico — como já faz para
   a web.
10. **A assinatura é verificada no servidor.** O que o StoreKit devolve no
    aparelho é um pedido, não uma prova. Quem muda o plano de uma conta é o
    servidor, depois de conferir a assinatura da Apple. Confiar no cliente aqui é
    entregar livros ilimitados a quem souber usar um proxy.

---

## 1. Escopo

### Entra

- Login com Google, nativo.
- Escolha do endereço público (handle), com as mesmas regras e a mesma copy.
- Lista de livros da conta, com uso contra o limite.
- Novo livro: escolher um PDF no app Arquivos/iCloud, gerar a capa, enviar com
  progresso real, salvar como rascunho.
- Editar metadados: título, subtítulo, endereço do livro, autor, descrição.
- Substituir o PDF de um livro existente.
- Publicar e despublicar.
- Excluir livro.
- Prévia do livro dentro do app, inclusive em rascunho.
- Compartilhar o link público pela folha de compartilhamento do iOS.
- Assinatura mensal por compra no app, com paywall ao chegar no limite.
- Tela de conta: e-mail, endereço público, plano, uso e gestão da assinatura.

### Não entra

Tudo que já está fora no `spec.md` seção 28 e no `EPICO-COBRANCA.md`, mais:

- Painel de administração da plataforma — continua só na web (critério 8.7).
- Vitrine pública de autor dentro do app.
- Leitura offline, download do PDF para o aparelho, anotação e marcação.
- iPad, Mac e visionOS como alvos declarados. O app é universal por construção
  (SwiftUI), mas **iPhone é o único alvo testado e o único suportado** nesta
  versão.
- Login com Apple. Não é exigido pela App Review enquanto o Google for o único
  serviço de terceiros usado para login **e** não houver outro método próprio;
  se a revisão exigir, entra numa versão seguinte, com o mesmo `sub` de conta
  (ver 15.2).
- Notificações push.

---

## 2. Arquitetura

```
iPhone (SwiftUI, iOS 17+)
  │
  │  HTTPS, Authorization: Bearer <token do app>
  ▼
virapagina.app.br (Next.js — o MESMO de hoje)
  │
  ├── /api/app/*     ← rotas novas: sessão e assinatura
  ├── /api/conta/*   ← as de hoje, agora aceitando bearer além do cookie
  │
  ▼
Firestore + Cloud Storage (Admin SDK, inalterados)
```

**Nada de Firebase no app.** Sem `firebase-ios-sdk`, sem `GoogleService-Info.plist`.
O aparelho conhece um único host: o nosso.

**Nenhuma dependência de terceiros no app.** Nem SDK do Google, nem biblioteca de
rede, nem de PDF. O login usa `ASWebAuthenticationSession` (que é o que o SDK do
Google faz por dentro no iOS), a rede usa `URLSession` e o PDF usa `PDFKit`. Cada
dependência a menos é uma renovação de certificado, uma quebra de build e um
incidente de privacidade a menos.

### Alvo

- **iOS 17.0** como mínimo. Abaixo disso o StoreKit 2 fica pela metade e o
  `Observable` não existe.
- Swift 5.9+, SwiftUI, um único target.
- Projeto gerado por **XcodeGen** a partir de `ios/project.yml`. O `.xcodeproj`
  não vai para o Git: ele é derivado, e `pbxproj` em diff é ilegível e conflita
  por natureza.

---

## 3. Autenticação

### O problema

A web usa Auth.js com sessão em cookie JWT. Um app nativo não tem como participar
disso sem hospedar um navegador — e a primeira tela do app seria uma página web.

### A solução

1. O app abre o consentimento do Google em `ASWebAuthenticationSession`, com
   **PKCE** e o client OAuth **do tipo iOS** (sem segredo, como manda o Google).
2. O Google devolve um `code` no esquema `com.googleusercontent.apps.<id>:/oauth`.
3. O app troca o `code` por `id_token` direto no Google (`oauth2.googleapis.com/token`).
4. O app manda o `id_token` para `POST /api/app/sessao`.
5. O servidor **valida o id_token** — assinatura contra o JWKS do Google,
   emissor, expiração e `aud` igual ao client iOS —, garante a conta com
   `garantirUsuario()` e devolve um **token do app**: um JWT nosso, HS256,
   assinado com `NEXTAUTH_SECRET`, com `sub` igual ao `sub` do Google, válido por
   30 dias.
6. O app guarda o token no **Keychain** (`kSecAttrAccessibleAfterFirstUnlock`,
   sem sincronização com iCloud) e o manda em `Authorization: Bearer` em toda
   requisição.

### O segundo provedor

O Login com Apple entrou depois, pela diretriz 4.8, e usa o mesmo desenho: o app
manda o `identityToken` para a mesma rota, que confere assinatura, emissor,
prazo e `aud` — este último sendo o **bundle id**, não um client OAuth. O campo
antigo `id_token` continua significando Google, porque a rota virou contrato
público no primeiro build enviado à loja.

Duas particularidades da Apple mudam o código: o e-mail só vem com garantia na
**primeira** autorização (nas seguintes, vale o que já está gravado na conta), e
o nome não vem no token — vem do aparelho, e uma vez só.

### Consequências

- `requireAutor()` passa a aceitar **cookie ou bearer**, nesta ordem, e continua
  sendo a primeira linha de toda rota `/api/conta/*`. A guarda não muda de
  assinatura: ela lê o cabeçalho por `headers()`, e nenhuma rota existente é
  reescrita.
- O `sub` do Google continua sendo o id da conta. **A mesma pessoa que entra no
  site e no app tem uma conta só** — não existe conta "do app".
- Token expirado devolve 401; o app apaga o token e volta para a tela de entrar,
  sem mensagem de erro técnica.
- Não há refresh token nosso. Trinta dias sem abrir o app custa um login; a
  alternativa é guardar um segredo de longa vida no aparelho.

---

## 4. Modelo de dados — o que muda

Três acréscimos em `usuarios`, e nada mais. Nenhuma coleção nova, nenhum campo
removido, nenhuma migração: documento sem os campos novos é lido com os padrões
abaixo, como já acontece hoje.

| Campo | Tipo | Padrão | Para quê |
|---|---|---|---|
| `plano` | passa a aceitar `'assinante'` | — | Quem paga a assinatura do app (regra iOS 10.3) |
| `assinatura` | objeto ou ausente | ausente | O estado da assinatura da App Store |
| `origem` | `'web'` ou `'app'` | `'web'` | Por onde a conta nasceu (regra iOS 10.1) |

O objeto `assinatura`:

| Campo | Tipo | Para quê |
|---|---|---|
| `loja` | `'app_store'` | Já nasce preparado para não mentir se um dia houver outra |
| `produto_id` | string | `app.br.virapagina.ilimitado.mensal` |
| `transacao_original_id` | string | A chave da assinatura na Apple. É por ela que a notificação encontra a conta |
| `status` | `'ativa' \| 'expirada' \| 'em_atraso' \| 'cancelada'` | O que o servidor concluiu |
| `expira_em` | string ISO | Fim do período pago corrente |
| `ambiente` | `'producao' \| 'sandbox'` | De onde veio a compra, para reconhecer no console (regra iOS 10.7) |
| `atualizado_em` | string ISO | Quando o servidor conferiu pela última vez |

---

## 5. Cobrança

### O produto

Um único produto: assinatura auto-renovável mensal, **R$ 9,90**, id
`app.br.virapagina.ilimitado.mensal`, grupo `virapagina.ilimitado`. Sem período
de teste gratuito, sem plano anual, sem nível intermediário — os cinco livros
gratuitos **são** o teste.

### O fluxo

1. A conta chega a 5 livros e toca em "Novo livro".
2. O app mostra o paywall com o preço **vindo da App Store**, nunca escrito à mão.
3. `StoreKit.Product.purchase()`.
4. O app manda o **JWS da transação** para `POST /api/app/assinatura`.
5. O servidor valida o JWS contra a cadeia de certificados da Apple, confere o
   produto, o ambiente e a validade, grava `assinatura` e muda o plano para
   `assinante`.
6. O app recarrega a conta e segue para o formulário de novo livro.

### Renovação, cancelamento e reembolso

`POST /api/app/assinatura/notificacoes` recebe as **App Store Server
Notifications V2**. É o servidor da Apple que avisa renovação, falha de cobrança,
cancelamento e reembolso; o app pode estar desinstalado. A notificação também é um
JWS e passa pela mesma validação.

Quando a assinatura deixa de valer, o plano volta para `gratuito`.

### O que acontece com quem tinha mais de 5 livros

**Nada sai do ar** (princípio 0.5 do `spec.md`, regra iOS 10.4). Os livros
continuam publicados e os links continuam respondendo. O que a conta perde é o
direito de criar o próximo — e é isso que o paywall informa, com todas as letras,
antes da compra.

---

## 6. Telas

Oito telas. A navegação é uma `TabView` de duas abas — **Livros** e **Conta** —
porque o app tem exatamente dois assuntos, e menu lateral em iPhone é padrão de
web disfarçado.

### 6.1 Entrar

Fundo claro, nome do produto em serifa, uma linha do que o produto faz, e um
botão único **"Entrar com Google"**. Uma linha abaixo: "Sua conta é criada
automaticamente no primeiro acesso." Links para termos e privacidade no rodapé
(exigência da App Review).

Estados: ocioso, entrando (botão com indicador), erro genérico.

### 6.2 Escolher endereço

Só aparece quando a conta não tem handle. Ocupa a tela inteira e **não é
pulável**. Campo com o prefixo fixo `virapagina.app.br/`, sugestão preenchida a
partir do nome do Google, verificação de disponibilidade enquanto digita, aviso
de que não dá para trocar depois. Copy idêntica à da web (`lib/copy.ts`).

### 6.3 Livros

Lista em `List` com estilo `.insetGrouped`. Cada linha: miniatura da capa,
título, `/<handle>/<slug>`, selo de estado. Cabeçalho da seção com "3 de 5
livros" — ou "3 livros" quando o plano é ilimitado.

Barra de navegação: título grande "Livros" e um `+`.

Estados: carregando (esqueleto), vazio ("Nenhum livro ainda."), limite atingido
(o `+` abre o paywall em vez do formulário), livro removido por denúncia (linha
com aviso em vermelho).

Puxar para atualizar.

### 6.4 Novo livro

Formulário em `Form`: título, subtítulo, endereço do livro (com o prefixo
`/<handle>/`), autor, descrição e o seletor de PDF. O seletor abre o
`fileImporter` do iOS.

Ao escolher o arquivo, o app **lê o PDF ali mesmo**: conta as páginas e desenha a
primeira como PNG para virar a capa (regra 11.1 do `spec.md` — a capa continua
sendo a primeira página, agora gerada pelo PDFKit em vez do PDF.js).

Progresso real em três etapas nomeadas, iguais às da web: "Lendo o PDF e gerando
a capa", "Enviando o arquivo", "Salvando o livro".

### 6.5 Livro

Cabeçalho com a capa, o título e o selo de estado. Botão primário que alterna
entre "Publicar" e "Despublicar". Botões "Ver como ficaria" (ou "Ver livro") e
"Compartilhar". Abaixo, em seções: metadados (toque abre a edição), "Substituir
PDF", detalhes (páginas, tamanho, criado, atualizado) e "Excluir livro" em
vermelho, com confirmação nomeando o título.

### 6.6 Editar metadados

O mesmo formulário do 6.4 sem o seletor de arquivo. Ao mudar o endereço de um
livro publicado, o mesmo aviso modal da web, com a mesma copy.

### 6.7 Leitor

`PDFView` do PDFKit em tela cheia, fundo escuro, rolagem horizontal página a
página com o efeito de virada do próprio PDFKit. Barra flutuante embaixo, em
pílula escura translúcida, com "12 de 44" e o botão de compartilhar. Em rascunho,
o subtítulo do cabeçalho ganha " · prévia de rascunho".

O PDF é baixado pela mesma rota de proxy da web, com o `?v=` de `lib/cache.ts`
(pegadinha 11 do `CLAUDE.md`: sem a versão, o autor troca o arquivo e continua
vendo o antigo).

### 6.8 Conta

E-mail, endereço público (com botão de copiar o link da vitrine), plano, uso
contra o limite e o bloco da assinatura: quando ativa, a data da próxima
renovação e um link para "Gerenciar assinatura" (que abre a folha do sistema);
quando não, o botão de assinar e "Restaurar compras". Rodapé com termos,
privacidade, "Falar com a gente" e "Sair".

### 6.9 Paywall

Folha modal. Título direto, o preço vindo da loja, três linhas do que muda, o
botão de assinar, "Restaurar compras" e os dois links legais. Diz, sem eufemismo,
que os livros já publicados continuam no ar mesmo sem assinatura.

---

## 7. Épicos e critérios de aceite

### Épico A — Backend aceita o app

- A.1 `POST /api/app/sessao` troca um `id_token` válido do Google por um token do
  app. `id_token` de outro `aud`, expirado ou com assinatura inválida devolve 401.
- A.2 Toda rota `/api/conta/*` funciona com `Authorization: Bearer <token>` do
  mesmo jeito que funciona com cookie, **inclusive as guardas**: bearer inválido
  devolve 401 sem tocar no Firestore nem no Storage.
- A.3 Livro de outra conta continua devolvendo 404 pelo bearer, nunca 403.
- A.4 `GET /api/conta/livros` lista os livros da conta e `GET /api/conta/livros/[id]`
  devolve um. `GET /api/app/conta` devolve conta, plano, uso, limite e assinatura.
- A.5 Conta criada pelo app nasce `gratuito` mesmo com `EARLY_ADOPTER_ABERTO`
  ligada; conta que já existe **não muda de plano** ao entrar pelo app.

### Épico B — Entrar e escolher endereço

- B.1 Login com Google em folha do sistema, sem sair do app; token no Keychain;
  ao reabrir, o app já entra.
- B.2 Conta sem handle cai na tela de escolha e não sai dela sem escolher.
- B.3 Handle indisponível mostra a sugestão e o botão de usá-la.
- B.4 "Sair" apaga o token e volta para a tela de entrar.

### Épico C — Livros

- C.1 Lista mostra capa, título, endereço e estado; puxar para atualizar recarrega.
- C.2 Novo livro com PDF do app Arquivos: capa gerada da primeira página,
  progresso real, livro nasce rascunho.
- C.3 PDF acima de 100 MB e arquivo que não é PDF são barrados **no app**, com a
  copy da seção 15 do `spec.md`, antes de qualquer envio.
- C.4 Publicar, despublicar, editar metadados, substituir PDF e excluir funcionam
  e refletem na web sem nada mais.
- C.5 Compartilhar abre a folha do iOS com a URL pública completa.
- C.6 Prévia abre o livro em rascunho para o dono.

### Épico D — Assinatura

- D.1 Conta no limite: o `+` abre o paywall, com o preço vindo da loja.
- D.2 Compra concluída vira plano `assinante` **depois** de o servidor validar.
- D.3 "Restaurar compras" reconhece uma assinatura ativa em outro aparelho.
- D.4 Expiração, cancelamento e reembolso rebaixam a conta para `gratuito` por
  notificação do servidor da Apple, sem o app abrir.
- D.5 Conta rebaixada com mais de 5 livros continua com **todos** eles no ar.
- D.6 JWS cuja cadeia não termina na Apple Root CA - G3 é recusado, inclusive o
  que o StoreKit Testing do Xcode gera localmente. Compra de sandbox é aceita e
  fica marcada como tal no documento da conta.

---

## 8. Contratos de API novos

Todos em JSON, erro no formato `{ "erro": "..." }`, como os de hoje.

### POST /api/app/sessao

```
{ "id_token": "<JWT do Google>" }
→ 200 { "token": "<JWT do app>", "expira_em": "ISO", "conta": { ...Conta } }
→ 401 { "erro": "Não foi possível entrar. Tente novamente." }
```

### GET /api/app/conta

```
→ 200 {
    "conta": { "id", "email", "nome", "handle", "plano", "rotulo_do_plano" },
    "uso": { "livros": 3, "limite": 5 },
    "assinatura": { "status", "expira_em" } | null
  }
```

### POST /api/app/assinatura

```
{ "transacao_jws": "<JWS assinado pela Apple>" }
→ 200 { "conta": {...}, "assinatura": {...} }
→ 400 { "erro": "Não foi possível confirmar a assinatura." }
```

### POST /api/app/assinatura/notificacoes

Recebe `{ "signedPayload": "<JWS>" }` da Apple. Sempre devolve 200 quando o JWS é
válido, mesmo que a conta não seja encontrada — repetir a notificação não
conserta um `transacao_original_id` que não temos. JWS inválido devolve 400.

### Rotas existentes que ganham método

- `GET /api/conta/livros` — lista.
- `GET /api/conta/livros/[id]` — um livro, 404 se for de outra conta.

---

## 9. Regras de negócio

**iOS 10.1 — Conta criada pelo app nasce gratuita.** `EARLY_ADOPTER_ABERTO` é
ignorada quando a origem é o app. A promessa de "ilimitado para sempre" foi feita
a quem entrou pelo site, sem nada a pagar; estendê-la a quem chega por um app que
existe para cobrar esvaziaria a cobrança antes do primeiro real.

**iOS 10.2 — Conta que já existe não muda de plano ao entrar pelo app.** Early
adopter que baixa o app continua ilimitado e **não vê paywall**. O plano é
propriedade da conta, não do aparelho.

**iOS 10.3 — `assinante` é ilimitado em livros e tem franquia de tráfego.** Igual
a `early_adopter` nos livros, com franquia de 200 GB/mês para que a válvula da
regra 11.11 continue existindo. Assinatura que caduca volta para `gratuito`.

**iOS 10.4 — Rebaixar nunca tira nada do ar.** Continuação direta do princípio
0.5. Perder a assinatura impede criar o próximo livro e mais nada.

**iOS 10.5 — Quem muda o plano é o servidor.** O app nunca escreve plano; ele
manda a prova da Apple e recarrega a conta.

**iOS 10.6 — O preço nunca é escrito no app.** Ele vem de
`Product.displayPrice`. Preço em `String` no código mente em outra moeda, em
outra região e no dia em que a tabela mudar.

**iOS 10.7 — Sandbox é aceito e registrado, nunca ignorado.** A App Review compra
em **sandbox contra o servidor de produção**: recusar por ambiente seria ser
rejeitado por um defeito nosso. O ambiente vai gravado em `assinatura.ambiente`,
para que uma conta promovida por compra de teste seja reconhecível no console. O
que protege aqui não é o ambiente, é a cadeia de certificados: só a Apple assina,
e só um sandbox tester criado por nós compra em sandbox neste app.

**iOS 10.8 — O limite de 100 MB é checado no aparelho e no servidor.** A checagem
do app é a que dá a mensagem; a do servidor é a que vale.

**iOS 10.9 — A capa continua sendo a primeira página do PDF.** Gerada no
aparelho, como na web é gerada no navegador. O servidor continua sem converter
PDF em imagem (princípio 0.1 e pegadinha 4 do `CLAUDE.md`).

**iOS 10.11 — Uma assinatura vale por uma conta.** Antes de promover alguém, o
servidor confere se aquele `originalTransactionId` já pertence a outra conta.
Sem isso, um mesmo Apple ID promoveria quantas contas quisesse: bastaria entrar
com outro Google no mesmo aparelho e restaurar a compra.

**iOS 10.12 — Login com Apple cria outra conta, sempre.** Nunca há vínculo
automático com uma conta do Google, nem por e-mail (decisão 15.2). O id é
prefixado com `apple:`, e a tela de entrar avisa antes de a pessoa escolher.

**iOS 10.10 — Toda URL de PDF e de capa leva `?v=`.** Mesma pegadinha 11 do
`CLAUDE.md`, agora com o cache do `URLSession` no lugar do da CDN.

---

## 10. Direção visual

O mesmo sistema do site, traduzido para o vocabulário do iOS — não copiado pixel
a pixel.

| Papel | Valor | Onde |
|---|---|---|
| Destaque | `#1C5FD8` | `tint` do app, botões primários, item ativo |
| Destaque escuro | `#12439B` | pressionado |
| Destaque fraco | `#EEF3FD` | fundo de pílula |
| Tela | `#F5F5F6` | fundo das listas e formulários |
| Superfície | `#FFFFFF` | cartões e linhas |
| Tinta | `#17181A` | texto forte |
| Tinta suave | `#5C5E64` | texto secundário |
| Hairline | `#E4E4E6` | separadores |
| Perigo | `#A32020` | excluir |
| Publicado | `#1A7F4B` | selo |

- **Tipografia:** a do sistema (San Francisco), com Dynamic Type funcionando de
  verdade. A serifa dos títulos grandes é `.system(.largeTitle, design: .serif)` —
  Instrument Serif não vale um arquivo de 300 KB no bundle para três telas.
- **Forma:** cantos de 10 a 16, hairlines de 1px (`0.5pt` reais), espaçamento
  generoso, nada de sombra pesada.
- **Sem modo escuro**, exceto o leitor, que é sempre escuro — igual à web.
- Componentes do sistema sempre que existir um: `Form`, `List`, `.insetGrouped`,
  folhas, `ShareLink`, `confirmationDialog`. App que desenha o próprio botão de
  voltar parece app feito por quem não usa iPhone.

---

## 11. Requisitos não-funcionais

- Abrir e mostrar a lista em menos de 2 s numa rede 4G comum.
- Upload de 100 MB com progresso real e possibilidade de cancelar.
- Acessibilidade: Dynamic Type até XXL sem corte, VoiceOver em todo controle,
  contraste mínimo AA.
- Nada de PII em log. O token nunca aparece em `print`.
- O app funciona offline no que já carregou e diz o que houve quando não há rede
  — nunca uma tela em branco.

---

## 12. Privacidade e App Review

- **Dados coletados:** e-mail e nome do Google (identificação), e os PDFs que o
  autor sobe (conteúdo do usuário). Sem rastreamento, sem publicidade, sem
  identificador de anúncio → `NSPrivacyTracking = false` e nenhum domínio de
  rastreio no manifesto de privacidade.
- **Excluir a conta:** a App Review exige que um app com conta permita **apagar a
  conta dentro do app**. Hoje nem o site faz isso — só excluir livro. Entra como
  parte do épico D+ (seção 13), porque sem isso o app é rejeitado.
- **Links legais** visíveis na tela de entrar, na conta e no paywall.
- **Sem menção a pagamento fora da App Store** em lugar nenhum do app, incluindo
  o texto do "Falar com a gente".

---

## 13. O que fica para depois

Declarado para não voltar como dúvida: Login com Apple, iPad, push, leitura
offline, vitrine dentro do app, plano anual, cupom, e o painel de admin.

**Excluir conta** não é "para depois": é requisito de publicação (12), e a rota
correspondente nasce junto do app — `DELETE /api/conta`, que apaga livros,
arquivos, handle e o documento da conta, nessa ordem.

---

## 14. Divergências declaradas em relação ao `spec.md`

1. **Plano novo `assinante`.** O `spec.md` lista seis planos; passam a ser sete.
   O `EPICO-COBRANCA.md` continua não implementado: o que entra é a esteira da
   Apple, não a do Stripe, e nenhum campo dele é criado.
2. **A regra 11.14 ganha uma exceção de origem** (regra iOS 10.1). A regra
   continua aplicada só na criação e continua sem rebaixar ninguém.
3. **O flipbook do leitor não é o mesmo.** Na web é `react-pageflip` com PDF.js;
   no app é o PDFKit. O efeito é diferente e é o do sistema. A regra que importa
   — o PDF original é a fonte, renderizado no cliente — continua valendo.

---

## 15. Assunções e perguntas abertas

15.1 **Assumido:** a conta de desenvolvedor Apple existe e o bundle id fica
`app.br.virapagina.ios`, no mesmo prefixo dos outros apps do Alexandre.

15.2 **Decidido em 12/09/2026: Apple e Google são contas separadas.**

O Login com Apple entra porque a diretriz 4.8 o exige de quem oferece login
social de terceiro — e porque o Alexandre já foi rejeitado por isso num app
anterior. A pergunta difícil nunca foi o botão, foi a conta.

**Não há vínculo por e-mail, e é deliberado.** Quem usa "Ocultar meu e-mail"
chega com um endereço `@privaterelay.appleid.com` que não é o do Google. Casar
por e-mail duplicaria a pessoa de qualquer jeito nesse caso, e no caso em que os
endereços batem estaria aceitando como prova de identidade um campo que ninguém
provou. Duas contas é honesto: a pessoa entra pelo provedor que usou da primeira
vez, e a tela de entrar avisa disso **antes**, não depois.

O id da conta da Apple é prefixado com `apple:`, para que um `sub` da Apple nunca
possa colidir com um `sub` do Google — que é o id de todas as contas que já
existem. Hoje os formatos são diferentes e a colisão seria improvável; improvável
não é impossível, e o custo de errar aqui é uma pessoa entrar na conta de outra.

**Fica de fora, e é dívida declarada:** a Apple pede que apagar uma conta criada
com Login com Apple também **revogue o token** dela, pelo endpoint
`appleid.apple.com/auth/revoke`. Isso exige uma chave "Sign in with Apple" (.p8)
no portal, guardar o refresh token de cada conta e assinar um client secret —
nada disso existe. O botão de excluir conta funciona e apaga tudo o que é nosso;
o que falta é avisar a Apple. Se a revisão cobrar, é meio dia de trabalho mais a
chave.

15.3 **Assumido:** R$ 9,90/mês, tier correspondente na tabela da Apple, sem teste
gratuito.

15.4 **Pergunta aberta:** o site liga cobrança um dia? Se ligar, quem assinou pelo
app **não** pode ser cobrado duas vezes, e o `EPICO-COBRANCA.md` precisa ler o
campo `assinatura` antes de criar qualquer cliente no Stripe.
