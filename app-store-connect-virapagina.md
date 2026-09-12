# App Store Connect — conteúdo pronto para colar (Virapágina)

Gerado a partir de `spec-ios.md` (o delta do `spec.md` para o app de iPhone).
Localização: **Português (Brasil)**, como idioma principal. Sem outras
localizações nesta versão.

Todos os campos de texto foram medidos com `check_limits.py` — o resultado está
no fim do documento.

---

## App Information

| Campo | Valor |
|---|---|
| **Nome** (≤30) | `Virapágina` |
| **Subtítulo** (≤30) | `Seu PDF vira livro folheável` |
| **Bundle ID** | `app.br.virapagina.ios` |
| **Apple ID do app** | `6811382515` |
| **SKU** | `virapagina-ios-001` |
| **Categoria primária** | Productivity |
| **Categoria secundária** | Books |
| **Copyright** | `© 2026 Alexandre Siqueira` |
| **Idioma principal** | Português (Brasil) |

**Sobre a categoria:** o app é a ferramenta de quem **publica**, não de quem lê —
por isso Productivity, e não Books como primária. Books entra como secundária
porque é onde alguém procurando "publicar meu livro" pode chegar.

**Sobre o bundle ID:** ele foge do padrão `com.dablab.<app>` dos outros apps, de
propósito — segue o domínio do produto, que já existe e é o mesmo endereço que
aparece em cada link publicado. **Ele já está registrado no client OAuth do
Google**, então mudá-lo agora significa refazer aquela credencial.

---

## Version Information

### Texto promocional (≤170 car.)

```
Suba o PDF, escolha o endereço e mande o link. Quem receber folheia no navegador — sem instalar nada, sem criar conta e sem marca d'água.
```

### Descrição (≤4.000 car.)

```
Você tem um PDF — um livro, uma revista, um portfólio, um relatório — e quer que as pessoas leiam. Mandar o arquivo por WhatsApp não resolve: ninguém abre um anexo de 12 MB no celular, e quem abre lê mal.

O Virapágina resolve isso em um minuto. Você sobe o PDF, escolhe o endereço e recebe um link. Quem recebe abre no navegador e folheia página por página, no celular ou no computador, sem instalar nada e sem criar conta.

COMO FUNCIONA
• Entre com sua conta Google.
• Escolha seu endereço público: virapagina.app.br/seunome
• Escolha um PDF no app Arquivos ou no iCloud.
• Publique e compartilhe o link.

O QUE VOCÊ RECEBE
• Um link limpo, com o seu nome e o nome do livro.
• A capa gerada da primeira página, sozinha.
• Leitura direto no navegador — sem app e sem cadastro para quem lê.
• Sem marca d'água, sem limite de páginas, sem prazo de validade.

PARA QUEM É
Autores independentes, editoras pequenas, fotógrafos com portfólio, designers, professores com material de aula, empresas com catálogo ou relatório, e quem faz zine.

O QUE MAIS DÁ PARA FAZER
• Trocar o PDF de um livro que já está no ar, mantendo o mesmo link.
• Editar título, subtítulo, autor e descrição quando quiser.
• Despublicar: o livro sai do ar na hora.
• Ver como ficou antes de publicar.

CINCO LIVROS DE GRAÇA
Os cinco primeiros são gratuitos, para sempre, sem marca d'água e sem pegadinha. Precisou de mais, a assinatura mensal libera livros ilimitados.

E se você cancelar, o que já estava publicado continua no ar. Link que circula não para de funcionar por causa de assinatura vencida — essa é a promessa do produto, não uma cortesia.

O SEU PDF É A FONTE
O Virapágina não converte seu arquivo em imagem nem recomprime nada. Quem lê está vendo o seu PDF original, e o que a pessoa baixa é exatamente o arquivo que você enviou.

ASSINATURA
Virapágina Ilimitado — R$ 9,90 por mês, com renovação automática.
O pagamento é cobrado na sua conta Apple ao confirmar a compra. A assinatura se renova automaticamente, a menos que a renovação seja desligada até 24 horas antes do fim do período. Você gerencia e cancela nos ajustes da sua conta Apple, quando quiser.
Termos de uso: https://virapagina.app.br/termos
Política de privacidade: https://virapagina.app.br/privacidade
```

**Por que o bloco ASSINATURA existe:** a diretriz 3.1.2 exige título, duração,
preço e os dois links legais na ficha de qualquer app com assinatura
auto-renovável. É rejeição fácil de evitar e cara de descobrir depois.

### Keywords (≤100 bytes)

```
flipbook,revista,catalogo,portfolio,zine,publicar,ebook,folhear,editora,autor,compartilhar
```

Sem acento em "catalogo" e "portfolio" de propósito: o campo é limitado em
**bytes**, cada acento custa dois, e a busca da Apple casa os dois jeitos. E sem
repetir "PDF", "livro" e "folheável" — eles já estão no nome e no subtítulo, que
a Apple já indexa.

### Notas da versão (What's New) — 1.0

```
Primeira versão.

Suba um PDF, escolha o endereço, publique e compartilhe o link. Cinco livros de graça, para sempre.
```

---

## App Privacy (questionário)

**Não é "Data Not Collected".** O app tem conta, backend próprio e guarda os
arquivos do autor. Marque exatamente isto:

| Categoria da Apple | O quê | Vinculado à identidade? | Usado para rastrear? | Finalidade |
|---|---|---|---|---|
| **Contact Info → Email Address** | O e-mail da conta Google | Sim | Não | App Functionality |
| **Contact Info → Name** | O nome da conta Google, quando existe | Sim | Não | App Functionality |
| **Identifiers → User ID** | O `sub` do Google, que é o id da conta | Sim | Não | App Functionality |
| **User Content → Other User Content** | Os PDFs enviados e a capa gerada deles | Sim | Não | App Functionality |
| **Usage Data → Other Usage Data** | Bytes servidos no mês, por conta | Sim | Não | App Functionality |

**Marque "No" em tracking (ATT) em tudo.** Não há SDK de anúncios, não há
analytics de terceiro, não há identificador de publicidade e nada é compartilhado
com data broker. O app não tem nem o prompt de ATT, porque não rastreia.

**Sobre a última linha:** o contador de tráfego existe para avisar o autor antes
da conta crescer demais (regra 11.11 do spec). Ele é agregado por conta e não
mede uso de tela. Declaro mesmo assim porque é um número associado a uma pessoa
identificada — e declarar a mais nunca causou rejeição; declarar a menos, sim.

**De quem lê um livro publicado não se coleta nada**: sem conta, sem cookie de
rastreamento, sem analytics. Isso vale a pena estar escrito na política.

---

## URLs obrigatórias

| Campo | Valor |
|---|---|
| **Support URL** | `https://suportedablab.carrd.co/` |
| **Marketing URL** (opcional) | `https://virapagina.app.br` |
| **Privacy Policy URL** | `https://virapagina.app.br/privacidade` |
| **License Agreement (EULA)** | `https://virapagina.app.br/termos` |

**Divergência do padrão da Dab Lab, e é deliberada:** a política de privacidade
**não** aponta para o documento do Notion. O Virapágina já tem uma página de
privacidade própria, publicada, escrita para este produto — e o documento
genérico da Dab Lab afirma coisas que aqui não são verdade (Firebase
Authentication anônima, Crashlytics, Analytics, permissões de câmera e galeria).
Apontar para ele colocaria duas fontes dizendo coisas diferentes sobre o mesmo
app, que é atrito garantido na revisão.

**Confira antes de submeter** se a página `/privacidade` cobre estes cinco
pontos, que é o que a revisão procura:

1. **Coleta de dados** — e-mail, nome e id da conta Google; os PDFs e as capas; o
   contador de tráfego mensal. De quem lê, nada.
2. **Uso dos dados** — identificar a conta, mostrar os livros do autor, servir os
   arquivos pelo link público e avisar o autor sobre consumo. Nada de
   publicidade, nada de venda, nada de perfilamento.
3. **Armazenamento e segurança** — Cloud Firestore e Cloud Storage, acesso só por
   servidor com credencial que não sai de lá; o navegador e o app nunca falam com
   o banco.
4. **Compartilhamento com terceiros** — Google (login e infraestrutura) e Apple
   (cobrança da assinatura). Mais ninguém. Sem data broker, sem rede de anúncios.
5. **Contato e exclusão** — `alexandre@dablab.com.br`, e o botão **Excluir conta**
   dentro do app, que apaga conta, livros e arquivos, com os links públicos
   deixando de funcionar.

---

## Pricing and Availability

| Campo | Valor |
|---|---|
| **Preço do app** | Grátis (Tier 0) |
| **Disponibilidade** | All Countries or Regions |
| **Pré-venda** | Não |

### Produto de In-App Purchase

| Campo | Valor |
|---|---|
| **Tipo** | Auto-Renewable Subscription |
| **Grupo de assinatura** | `virapagina.ilimitado` (nome de referência: Virapágina Ilimitado) |
| **Product ID** | `app.br.virapagina.ilimitado.mensal` |
| **Nome de referência** (interno) | Assinatura mensal |
| **Duração** | 1 mês |
| **Preço** | R$ 9,90 (Brasil) — deixe a Apple converter para os demais países |
| **Nome de exibição** (≤30) | `Virapágina Ilimitado` |
| **Descrição** (≤30) | `Publique quantos livros quiser` |
| **Período de teste grátis** | Nenhum — os cinco livros gratuitos **são** o teste |

O Product ID precisa ser **exatamente** esse: ele está escrito em
`ios/Virapagina/Loja/Loja.swift` e em `lib/appstore.ts`, e o servidor recusa JWS
de qualquer outro produto.

### App Store Server Notifications (V2)

Em App Store Connect → App Information → App Store Server Notifications:

| Campo | Valor |
|---|---|
| **Version** | Version 2 |
| **Production Server URL** | `https://virapagina.app.br/api/app/assinatura/notificacoes` |
| **Sandbox Server URL** | `https://virapagina.app.br/api/app/assinatura/notificacoes` |

Sem isso, cancelamento, reembolso e falha de cobrança só seriam percebidos quando
a pessoa abrisse o app — ou seja, nunca, porque quem cancelou não abre.

---

## App Review Information

### Sign-in Required

**Sim.** O app é a ferramenta do autor: sem conta não há o que mostrar, e não
existe modo convidado (quem só quer ler não precisa do app — lê pelo navegador).

| Campo | Valor |
|---|---|
| **Username** | `appsdablab@gmail.com` |
| **Password** | está em `app-review-credenciais.local.md` |

**A senha não está neste arquivo de propósito.** Este documento é para ser
versionado; senha em histórico de Git não sai mais de lá, nem com `git rm`. Ela
mora em `app-review-credenciais.local.md`, que o `.gitignore` cobre pelo padrão
`*.local.md`.

**Três coisas precisam estar verdadeiras nessa conta antes de submeter:**

1. **Sem verificação em duas etapas.** Se o Google pedir código por SMS, o
   revisor trava — ele não tem o seu telefone. Confira em
   myaccount.google.com/security com a conta aberta.
2. **Sem passkey obrigatória.** Se a conta só aceitar passkey, o login falha no
   aparelho do revisor. Ela precisa aceitar **senha**.
3. **Com conteúdo dentro.** Entre uma vez pelo app depois do deploy, escolha um
   endereço público e publique um ou dois livros. Tela vazia é motivo real de
   rejeição — o revisor precisa ver o produto funcionando, e no limite de 5
   livros, para alcançar o paywall.

### Contact Information

| Campo | Valor |
|---|---|
| **First name / Last name** | Alexandre / Siqueira |
| **Phone** | `+55 21 97214-4606` |
| **Email** | alexandre@dablab.com.br |

### Notes

```
Olá! Obrigado por revisar.

Pontos que costumam ser perguntados, já respondidos:

1. POLÍTICA DE PRIVACIDADE E TERMOS DE USO
Os dois estão acessíveis de dentro do app, sem login: na tela de entrada (rodapé), na aba Conta e também na tela de assinatura.
Privacidade: https://virapagina.app.br/privacidade
Termos: https://virapagina.app.br/termos

2. EXCLUIR CONTA
Aba Conta > Excluir conta. A confirmação pede que o usuário digite o próprio endereço. A exclusão apaga a conta, os livros e os arquivos enviados, e os links públicos param de funcionar.

3. SAIR (LOGOUT)
Aba Conta > Sair.

4. LOGIN COM APPLE
O app oferece Iniciar Sessão com a Apple e login com Google, com a opção da Apple em primeiro lugar na tela de entrada.
Cada provedor cria uma conta separada, e a tela de entrada avisa isso antes da escolha ("Apple e Google criam contas separadas — entre sempre pelo mesmo"). Não há vínculo automático entre as duas: quem usa "Ocultar meu e-mail" chega com um endereço de relay diferente do Google, e unir as contas por e-mail seria aceitar como prova de identidade um dado que não prova nada.
Para revisar o app já com conteúdo, use a conta de teste informada acima, que é uma conta Google.

5. TROCAR SENHA
Não se aplica: o app não tem senha própria. A autenticação é pelo provedor escolhido — Apple ou Google —, e a senha é gerenciada por eles.

6. PERMISSÕES DO SISTEMA
O app não usa câmera, microfone, localização, contatos, calendário nem notificações. O único acesso a arquivos é pelo seletor de documentos do próprio iOS, quando o usuário escolhe um PDF — não há acesso à galeria nem leitura de arquivos sem essa escolha explícita.

7. COMO TESTAR A ASSINATURA
A conta de teste já vem com livros publicados. O app dá 5 livros gratuitos; ao tentar criar o sexto, o paywall aparece (também acessível a qualquer momento em Conta > Assinar livros ilimitados).
Para chegar ao paywall sem precisar subir 5 arquivos, use a conta de teste informada acima: ela já está no limite.
Com um Sandbox Apple ID, a compra conclui normalmente e a conta passa a ter livros ilimitados na mesma sessão. O botão "Restaurar compras" está na mesma tela.
Importante: cancelar a assinatura NÃO tira do ar os livros já publicados. Isso é intencional e está escrito na tela de assinatura.

8. O QUE O APP FAZ COM O PDF
Nada além de guardar e mostrar. O arquivo não é convertido, recomprimido nem alterado — quem lê o link público está vendo o PDF original que o autor enviou. A capa é a primeira página, gerada no próprio aparelho.

9. CONTEÚDO
Cada pessoa só vê os próprios livros dentro do app. Não há feed, catálogo de terceiros, chat nem qualquer conteúdo de outros usuários visível no app. Livros publicados ficam acessíveis por link no navegador, e há canal de denúncia com e-mail de contato na página de termos.

Support website: https://suportedablab.carrd.co/
Contato: alexandre@dablab.com.br
```

---

## App Encryption Documentation

**Resposta: "None of the algorithms mentioned above".**

O app só faz HTTPS por `URLSession`, guarda o token no Keychain e usa
`CryptoKit` para o SHA-256 do PKCE do login — todos frameworks padrão da Apple, e
o SHA-256 é hash, não criptografia. Não há nenhum esquema criptográfico próprio.

O `Info.plist` já traz `ITSAppUsesNonExemptEncryption = false`, então o build não
deve nem parar em "Missing Compliance".

---

## Content Rights

**Resposta: "No, it does not contain, show, or access third-party content".**

O app mostra exclusivamente o que o próprio usuário enviou. Não há banco de
imagens, fonte licenciada, base de dados redistribuída nem conteúdo de terceiro
embutido — a mesma lógica de um visualizador de arquivos.

---

## Classificação etária (Age Rating) — expectativa

Expectativa: **4+**. Não é a resposta oficial; só o questionário da Apple decide.

O questionário vai perguntar sobre conteúdo gerado por usuário. A resposta
honesta: **dentro do app, cada pessoa vê apenas o próprio conteúdo** — não há
feed, catálogo alheio, chat, mensagem direta nem perfil de terceiro. Não há IA
generativa, jogo, aposta, álcool, violência nem conteúdo adulto.

**Ponto de atenção:** o produto publica na web, e a diretriz 1.2 (conteúdo gerado
por usuário) pede filtro, denúncia e bloqueio quando o app **exibe** conteúdo de
terceiros. Aqui ele não exibe — mas se o revisor levantar o assunto, a resposta
pronta é a do item 8 das notas: o canal de denúncia existe na página de termos, e
a plataforma despublica conteúdo que viole os termos (regra 11.12, já
implementada).

---

## Roteiro de criação, na ordem

Quinze passos. Os quatro primeiros são no navegador e não dependem do app estar
pronto; dá para fazer hoje.

### Antes de tudo

**1. Registrar o App ID.**
developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → **+**
→ App IDs → App → Description `Virapagina iOS`, Bundle ID **Explicit**:
`app.br.virapagina.ios`. Marque a capability **In-App Purchase** (vem marcada por
padrão). Nada mais precisa ser marcado — o app não usa push, iCloud nem Sign in
with Apple.

**2. Criar o app no App Store Connect.**
appstoreconnect.apple.com → Apps → **+** → New App → iOS → Nome `Virapágina`,
idioma principal Português (Brasil), Bundle ID `app.br.virapagina.ios`, SKU
`virapagina-ios-001`, acesso completo.

**3. Preencher a ficha** com a seção "App Information" e "Version Information"
deste documento.

**4. Criar o grupo de assinatura e o produto**, com os valores da seção
"Pricing and Availability". O grupo primeiro, o produto depois. Preencha também a
localização pt-BR do produto (nome de exibição e descrição) — sem ela o produto
não fica "Ready to Submit" e o paywall aparece **vazio** no app.

**O produto não é aprovado antes do app, e não precisa ser.** A primeira
assinatura de um app é revisada **junto com o primeiro build**: você a cria, ela
fica "Ready to Submit", e na hora de enviar o app ela vai anexada. O que importa
agora é que ela **exista** — porque é a existência dela, e não a aprovação, que
faz o preço aparecer no app e o sandbox funcionar no TestFlight.

**5. Ligar as App Store Server Notifications V2**, com as duas URLs da mesma
seção. Isso pode ser feito antes do primeiro build.

### Quando for gerar o build

**6. Trocar a assinatura de código.** Em `ios/project.yml`, hoje está
`CODE_SIGNING_ALLOWED: NO` — é o que permite compilar no simulador em qualquer
máquina, sem conta. Para arquivar de verdade, abra o projeto no Xcode e ponha o
seu time em Signing & Capabilities, ou acrescente `DEVELOPMENT_TEAM` ao
`project.yml` e rode o `xcodegen` de novo.

**7. Apontar o app para produção.** `ios/Configuracao.xcconfig` precisa ter
`API_BASE_URL = https:/$()/virapagina.app.br`. É o erro mais fácil de cometer:
subir para a App Store um build que fala com `localhost`.

**8. Conferir a versão.** `MARKETING_VERSION` e `CURRENT_PROJECT_VERSION` vivem
no `project.yml`. A cada envio novo, o build precisa de um número maior.

**9. Arquivar.** Xcode → Product → Destination: Any iOS Device → Product →
Archive → Distribute App → App Store Connect → Upload.

**10. Responder o Export Compliance** se ele aparecer: "None of the algorithms
mentioned above".

### Antes de submeter

**11. Screenshots.** Só o tamanho 6,9" é obrigatório — veja a seção seguinte.

**12. Conta de teste.** A conta já existe (`appsdablab@gmail.com`). Entre pelo
app uma vez **depois do deploy**, escolha um endereço e publique um ou dois
livros. Confira antes que ela não exige verificação em duas etapas nem passkey.

**13. Testar a compra em sandbox.** App Store Connect → Users and Access →
Sandbox → Testers. No iPhone: Ajustes → App Store → Sandbox Account. Instale o
build pelo TestFlight e faça a compra inteira — é o único jeito de exercitar o
caminho real do JWS até o servidor, porque o StoreKit local do Xcode assina com
certificado próprio e o servidor recusa, de propósito.

**14. Conferir que as notificações chegaram.** Depois da compra em sandbox, veja
no log da Vercel se `/api/app/assinatura/notificacoes` recebeu algo. Se não
recebeu, a URL está errada ou não foi salva.

**15. Submeter.** Selecione o build, responda o questionário de classificação
etária, confirme os direitos de conteúdo, e envie.

---

## Screenshots de marketing

**Tamanho: 6,5 polegadas — 1242 × 2688**, o mesmo conjunto dos outros apps da Dab
Lab. Capturados nativamente num iPhone 11 Pro Max, sem redimensionar. Como o app
é só iPhone, **não há screenshot de iPad para fazer**.

As cinco estão prontas, em `loja/`:

| Arquivo | Tela | Frase na imagem |
|---|---|---|
| `loja-1-livros.png` | Lista com cinco livros e capas de verdade | Seus livros, cada um com o seu link |
| `loja-2-novo.png` | Formulário de novo livro preenchido | Escolha o PDF. O resto é automático |
| `loja-3-publicar.png` | Livro publicado, com as ações | Publicar e compartilhar é um toque |
| `loja-4-leitor.png` | Leitor, fundo escuro, página 3 de 12 | Quem recebe folheia no navegador, sem app |
| `loja-5-assinatura.png` | Paywall, no limite de 5 livros | Cinco livros de graça. Depois, ilimitado |

As telas cruas, sem moldura nem frase, ficam em `loja/telas/` — servem para
recapturar ou remontar sem repetir o caminho todo.

**Para a configuração do In-App Purchase**, a App Store Connect pede uma
*Review Screenshot* da tela de compra: use `loja/iap-tela-de-revisao.png`, que é
o print **cru** do paywall, sem moldura de marketing.

### Um pendente nesse conjunto

A imagem 5 e a de revisão do IAP saem com o botão escrito apenas **"Assinar"**,
sem o preço. O preço vem da App Store (regra iOS 10.6, e é o certo), e a loja
local de desenvolvimento **não** carrega pelo `simctl` — só pelo Xcode.

Rode o app pelo Xcode (⌘R, que aplica o `Virapagina.storekit` do esquema) e
recapture essas duas: o botão passa a ler "Assinar por R$ 9,90 por mês". Depois
que o produto existir na App Store Connect, o mesmo vale com o preço real.

Como refazer qualquer uma delas está em `ios/Ferramentas/README.md`.

---

## Resultado da checagem de limites

```
Nome: 10/30 caracteres [OK]
Subtítulo: 28/30 caracteres [OK]
Texto promocional: 137/170 caracteres [OK]
Descrição: 2255/4000 caracteres [OK]
Keywords: 90/100 bytes [OK]
Notas da versão (What's New): 117/4000 caracteres [OK]
Notas de revisão (App Review): 2256/4000 caracteres [OK]
Nome de exibição do IAP: 20/30 caracteres [OK]
Descrição do IAP: 30/30 caracteres [OK]
```

Todos passaram. Dois merecem o olho:

- **Descrição do IAP: 30/30.** Está no limite exato. Se a App Store Connect
  recusar por um caractere, tire o "quantos": `Publique os livros que quiser`
  (29).
- **Keywords: 90/100 bytes.** Sobram 10 bytes — cabe mais uma palavra curta sem
  acento, se você quiser acrescentar algo depois de ver o que as pessoas buscam.
