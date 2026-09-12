# Virapágina para iPhone

App nativo do autor: entra com o Google, sobe PDF, publica e compartilha o link.
Quem lê continua lendo no navegador, sem conta e sem app.

O que o app é, o que ele não é e por que cada decisão foi tomada está em
[`../spec-ios.md`](../spec-ios.md). Este arquivo é só como rodar.

## O que você precisa

- Xcode 16 ou mais novo, com um simulador de iPhone (iOS 17+).
- XcodeGen: `brew install xcodegen`.
- O servidor no ar — o de produção ou o `npm run dev` da raiz.

## Rodar

```bash
cd ios
xcodegen generate      # cria o Virapagina.xcodeproj a partir do project.yml
open Virapagina.xcodeproj
```

O `.xcodeproj` **não** está no Git: ele é derivado do `project.yml`. Rode o
`xcodegen` de novo sempre que acrescentar um arquivo — as fontes são varridas da
pasta, então não é preciso editar nada.

Pela linha de comando:

```bash
xcodebuild -project ios/Virapagina.xcodeproj -scheme Virapagina \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

## Configurar antes do primeiro login

Dois valores, os dois em `ios/Configuracao.xcconfig`:

1. **`GOOGLE_CLIENT_ID`** — crie no Google Cloud → Credenciais → Criar
   credenciais → ID do cliente OAuth → **iOS**, com o bundle
   `app.br.virapagina.ios`. É **outro client** que o da web; o da web não
   funciona aqui e o daqui não tem segredo, como manda o Google para app nativo.
2. **`GOOGLE_CLIENT_ID_REVERSO`** — o mesmo id ao contrário, sem o sufixo. O
   Google mostra esse valor na própria tela da credencial.

E o mesmo id do item 1 vai no servidor, em `GOOGLE_OAUTH_IOS_CLIENT_ID`: é contra
ele que a rota `/api/app/sessao` confere o `aud` do token. Sem isso o login
devolve 401 — corretamente.

Para falar com o servidor local em vez da produção, troque `API_BASE_URL`. No
simulador `localhost` funciona; num iPhone de verdade é preciso o IP da máquina
na rede.

## A assinatura

Em desenvolvimento, o esquema já aponta para `Virapagina.storekit`: o paywall
funciona no simulador, com preço de mentira, sem App Store Connect. A compra
gera um JWS assinado por um certificado **local**, que o servidor recusa de
propósito — a validação exige a cadeia da Apple (regra iOS 10.5). Para ver o
caminho inteiro é preciso um sandbox tester e um build de TestFlight.

Na App Store Connect, o produto precisa nascer com o id
`app.br.virapagina.ilimitado.mensal`, no grupo `virapagina.ilimitado`,
mensal, R$ 9,90.

E a URL de notificações do servidor da Apple (V2, produção e sandbox):

```
https://virapagina.app.br/api/app/assinatura/notificacoes
```

Sem ela, cancelamento e reembolso só seriam percebidos quando a pessoa abrisse o
app — isto é, nunca.

## Onde as coisas moram

```
Virapagina/
  App/        entrada, configuração, copy e slug
  Design/     cores e as poucas peças visuais próprias
  Rede/       cliente da API, sessão, login Google, Keychain, upload
  Loja/       StoreKit 2
  Pdf/        leitura do PDF e o leitor em PDFKit
  Telas/      as oito telas da seção 6 do spec-ios
```

## O que não pode ser quebrado

1. **Nenhuma regra de negócio em Swift.** Limite de plano, unicidade de handle e
   de slug, publicação e exclusão são do servidor. O app desenha e pede.
2. **O app nunca escreve plano.** Ele manda o JWS da Apple e relê a conta.
3. **As URLs de PDF e capa vêm prontas do servidor, com `?v=`.** Montá-las aqui
   faria o autor trocar o arquivo e continuar vendo o antigo.
4. **O token vai no Keychain**, nunca em `UserDefaults`, e nunca em `print`.
