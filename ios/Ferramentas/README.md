# Bastidor da loja

Três ferramentas que **não fazem parte do app**. Servem para produzir as imagens
da App Store sem depender de um login de verdade nem de dados reais.

Rodam contra o **emulador** e o servidor local. Nenhuma delas toca em produção.

## 1. Os PDFs de exemplo

```bash
cd ios/Ferramentas && swift gerar-pdfs-de-exemplo.swift
```

Cinco livros com capa própria e miolo plausível, em A4. A capa sai também em PNG,
no mesmo desenho — é o que o semeador sobe junto, já que ele não passa pelo app.

## 2. A conta e os livros

Com `npm run emu` e `npm run dev` no ar:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
STORAGE_EMULATOR_HOST=http://127.0.0.1:9199 \
node ios/Ferramentas/semear-para-screenshots.mjs 5
```

Cria uma conta **gratuita, com origem `app`** — a mesma que quem baixa o app
encontra, com limite de 5 livros — e semeia os livros gerados no passo 1. No fim
ele imprime um `TOKEN=`: é um token do app, assinado com o segredo do servidor
local.

## 3. O app, já logado

O app aceita esse token **só em build de depuração** (`#if DEBUG` em
`Rede/Sessao.swift`). Existe porque a folha do Google empurra passkey no
simulador, e passkey entre aparelhos precisa de Bluetooth, que o simulador não
tem — sem isso, capturar tela exigiria um iPhone físico.

```bash
SIM=$(xcrun simctl create "iPhone 11 Pro Max" \
  com.apple.CoreSimulator.SimDeviceType.iPhone-11-Pro-Max \
  com.apple.CoreSimulator.SimRuntime.iOS-26-1)
xcrun simctl boot $SIM
xcrun simctl status_bar $SIM override --time "09:41" --batteryState charged \
  --batteryLevel 100 --cellularBars 4 --wifiBars 3
xcrun simctl install $SIM "<caminho>/Virapágina.app"
SIMCTL_CHILD_VIRAPAGINA_TOKEN_DE_TESTE="<o token>" \
  xcrun simctl launch $SIM app.br.virapagina.ios
```

O iPhone 11 Pro Max dá **1242 × 2688**, que é o tamanho de 6,5 polegadas da App
Store — o mesmo conjunto usado nos outros apps da Dab Lab.

## 4. As imagens finais

```bash
swift ios/Ferramentas/montar-imagens-da-loja.swift loja/telas loja
```

Põe a frase de marketing em cima e a tela embaixo. As telas cruas ficam em
`loja/telas/`; a pasta `loja/` inteira é ignorada pelo Git, porque é derivada.

## O que ainda precisa de você

O preço do paywall vem da App Store, e o StoreKit local **não** carrega pelo
`simctl` — só pelo Xcode. Então a imagem 5 sai com o botão escrito apenas
"Assinar". Rode o app pelo Xcode (⌘R, que aplica o `Virapagina.storekit` do
esquema) e recapture essa tela para o botão aparecer como "Assinar por R$ 9,90
por mês".
