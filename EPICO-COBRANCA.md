# Épico de cobrança — Virapágina

Desenho, não implementação. A seção 3 do `spec.md` mantém a cobrança **fora do MVP**, e este documento existe para que o dia de escrever o código não comece com decisão pendente.

| | |
|---|---|
| Origem | Conversa de 8 de setembro de 2026, quando o produto virou multi-tenant |
| Decidido com o dono em | 8 de setembro de 2026 |
| Estado | **Desenhado. Não implementado.** |
| Por que fora do MVP | Nas palavras do dono: *"ninguém vai usar mesmo"*. Construir a esteira de cobrança antes do primeiro usuário é montar linha de produção para uma fábrica que ainda não abriu. O mesmo raciocínio que adiou a emissão automática de nota no Visão de Produto |
| O que precisa acontecer antes | Contas reais publicando livros de verdade, e ao menos uma pessoa esbarrando no limite de 5 e pedindo mais |
| Referência de arquitetura | `EPICO-COBRANCA.md` do projeto Visão de Produto, de 17/08/2026 — de onde vêm a idempotência por evento, o webhook como fonte da verdade, a reconciliação diária e a cortesia como coluna |

---

## 1. As decisões, e o que cada uma descarta

| # | Decisão | O que ela descarta, e por quê |
|---|---|---|
| **C1** | **Preço por faixa de quantidade de livros.** Quatro faixas: grátis até 5, R$ 20 até 20, R$ 40 até 50, R$ 80 até 100 | Descarta o preço único que o Visão de Produto adotou (decisão C2 de lá). A diferença é real: naquele produto o custo marginal de mais um projeto era zero, então cobrar por projeto só criava hesitação. Aqui **o custo marginal é o arquivo guardado e servido** — cresce com o volume, e o preço acompanha |
| **C2** | **Tráfego não é preço, é válvula.** Cada faixa tem franquia mensal de saída de dados; passar dela gera aviso e conversa, nunca cobrança extra nem corte | Descarta a cobrança por leitura ou por banda. Ela puniria o sucesso: quanto mais lido o livro, maior a conta. Ninguém publica com medo de dar certo |
| **C3** | **R$ em real, via Stripe Brasil** | Descarta cobrar em USD. A conta Stripe do dono é brasileira e liquida em BRL, e o público-alvo é brasileiro — não paga IOF nem spread. Consequência assumida: **obrigação de emitir NFS-e**, tratada na seção 5 |
| **C4** | **A quantidade de livros é o que separa grátis de pago.** Nunca marca d'água, nunca limite de páginas, nunca expiração | É o gatilho que não estraga o produto de quem não paga. Marca d'água no gratuito é exatamente o que torna o Heyzine gratuito inútil — e o motivo de o dono pagar por ele hoje |
| **C5** | **Rebaixar não apaga e não tira do ar.** Bloqueia publicar livro novo; não bloqueia leitura, não despublica, não exclui | Descarta apagar ou esconder dado de quem parou de pagar. Link que circula é o produto inteiro: quebrá-lo por atraso destrói mais valor do que a mensalidade recupera, e gera raiva desproporcional ao dinheiro envolvido |
| **C6** | **Cortesia é uma coluna**, não uma integração | Uma conta pode ser paga sem nunca ter passado pelo Stripe. É como a conta do próprio dono funciona |
| **C7** | **O webhook é a verdade; o retorno do navegador não é** | Descarta aplicar o plano no redirect de volta do Checkout. Redirect é o navegador falando; webhook é o Stripe falando, e só um dos dois é confiável |

### Preços e franquias

| Plano | Limite de livros | Preço mensal | Franquia de tráfego |
|---|---|---|---|
| `gratuito` | 5 | R$ 0 | 20 GB |
| `ilimitado` | sem limite | — (contas do dono) | sem franquia |
| `ate_20` | 20 | R$ 20,00 | 50 GB |
| `ate_50` | 50 | R$ 40,00 | 100 GB |
| `ate_100` | 100 | R$ 80,00 | 200 GB |

As franquias são chute calibrado: 20 GB são cerca de 2.200 downloads de um PDF de 9 MB, o que cobre um post que foi bem no LinkedIn. **Continuam pendentes de revisão do dono** — são elas que seguram a fatura do Google, que no plano Blaze não tem teto de gasto.

Não há faixa acima de 100 livros. Quem chegar lá recebe aviso e conversa.

---

## 2. O que muda no modelo de dados

O MVP já nasce com `plano`, com o limite aplicado (regra 11.8 do spec) e com a medição de tráfego (`trafego_mes_bytes`). **Isto aqui é adição, não reescrita** — e foi de propósito: retrofitar um limite em contas que já existem é a parte que dói fazer depois.

### `usuarios` — campos novos

| Campo | Tipo | Para quê |
|---|---|---|
| `cortesia` | boolean, default `false` | Conta paga sem Stripe (decisão C6). Enquanto verdadeira, nenhuma rotina de cobrança encosta nela |
| `stripe_cliente_id` | string | Nulo até a primeira assinatura |
| `assinatura_id` | string | Id da assinatura no Stripe. Nulo em conta gratuita e em cortesia |
| `assinatura_status` | `status_assinatura` | O estado **espelhado** do Stripe. Nunca é escrito pela tela |
| `periodo_fim` | timestamp | Até quando o período pago vale. É o que a carência do rebaixamento usa |
| `tomador_tipo` | `tipo_tomador` | Nulo enquanto a conta nunca assinou |
| `tomador_documento` | string | CPF ou CNPJ, só dígitos |
| `tomador_nome` | string | Nome completo (PF) ou razão social (PJ) |
| `tomador_endereco` | map | Só para PJ: `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `municipio`, `estado` |

### Enums novos

- `status_assinatura`: `nenhuma`, `ativa`, `atrasada`, `cancelada`.
- `tipo_tomador`: `pessoa_fisica`, `pessoa_juridica`.

O nome importa: `assinatura_status` é **espelho**, não verdade. A verdade mora no Stripe, e a reconciliação da seção 4 existe justamente porque espelho desatualiza.

### Coleção nova — `eventos_stripe`

Id do documento: **o `event.id` do Stripe**. É a chave que evita aplicar o mesmo efeito duas vezes.

| Campo | Para quê |
|---|---|
| `tipo` | `checkout.session.completed`, `customer.subscription.updated`, … |
| `conta_id` | A conta afetada, quando dá para resolver |
| `recebido_em` | Quando chegou |
| `processado_em` | Nulo enquanto não foi aplicado |

Webhook chega duplicado, fora de ordem e às vezes duas vezes ao mesmo tempo. A gravação com `create` (que falha se o documento já existe) é o que torna o processamento idempotente: documento existente significa "já vi esse evento" e o handler devolve 200 sem fazer nada.

### `acoes_admin` — valores novos em `acao_admin`

`concedeu_cortesia`, `removeu_cortesia`.

---

## 3. Os fluxos

### 3.1 Assinar

1. `/conta/plano` mostra o plano atual, o uso e as quatro faixas.
2. Antes do Checkout, a tela pergunta **pessoa física ou jurídica** e coleta os dados fiscais (seção 5). Sem eles, o botão não avança.
3. A rota de servidor cria a Checkout Session com `client_reference_id` igual ao id da conta, reaproveitando `stripe_cliente_id` quando já existe.
4. O navegador vai para o Stripe. A pessoa paga lá — **nenhum dado de cartão passa pela plataforma, em momento nenhum.**
5. Volta para `/conta/plano?assinatura=processando`.

**A regra dura (decisão C7):** a volta do navegador **não** muda plano nenhum. Ela só mostra "Estamos confirmando seu pagamento. Isso leva alguns segundos." Quem muda o plano é o webhook.

### 3.2 Webhook

Rota pública em `POST /api/cobranca/webhook`, assinatura verificada com o segredo do Stripe, **fora de qualquer middleware de sessão**.

1. Verifica a assinatura. Falhou: `400`, e nada acontece.
2. Grava em `eventos_stripe` com `create`. Documento já existente significa evento já visto → responde `200` e para.
3. Aplica o efeito conforme o tipo:

| Evento do Stripe | Efeito |
|---|---|
| `checkout.session.completed` | Aplica a faixa comprada, guarda `assinatura_id` e `stripe_cliente_id` |
| `customer.subscription.updated` | Espelha `assinatura_status` e `periodo_fim`; aplica a faixa quando o preço mudou |
| `customer.subscription.deleted` | `assinatura_status = cancelada`. **Não rebaixa agora** — quem rebaixa é a rotina diária, depois de `periodo_fim` |
| `invoice.payment_failed` | `assinatura_status = atrasada`. O Stripe cuida das retentativas |

4. Marca `processado_em` e responde `200`.

Qualquer erro no meio devolve `500` **sem** marcar `processado_em`: o Stripe reenvia, e reprocessar evento não aplicado é correto.

### 3.3 Rebaixamento (decisão C5)

Dispara quando `assinatura_status` é `cancelada` e `periodo_fim` já passou.

| O que acontece | O que **não** acontece |
|---|---|
| `plano = gratuito` | Nenhum livro é excluído |
| Publicar livro novo passa a ser recusado enquanto a conta estiver acima de 5 | Nenhum livro é despublicado |
| | Nenhuma leitura é bloqueada |
| | Nenhum link para de funcionar |
| | O download continua funcionando |

Conta que tinha 30 livros continua com 30, todos no ar, todos legíveis. Ela só não publica o trigésimo primeiro. Voltar a pagar devolve o limite na hora, sobre livros que nunca saíram do lugar — e é exatamente isso que torna o retorno indolor.

### 3.4 Trocar de faixa

Para cima vale na hora; para baixo, no fim do período. É o comportamento padrão do Stripe, e não se implementa lógica própria para isso.

**Cair para uma faixa menor do que o número de livros que a conta tem** segue a regra C5: nada sai do ar, só não se publica mais.

### 3.5 Cancelar

Leva ao **Portal do Cliente do Stripe**. A plataforma não implementa tela de cancelamento — cancelar é do fornecedor de pagamento, e reimplementar isso é assumir manutenção sem ganho.

### 3.6 Cortesia

O admin da plataforma marca `cortesia = true`. A conta passa a valer como `ate_100` e **toda rotina de cobrança passa direto por ela**: sem cliente no Stripe, sem assinatura, sem rebaixamento. Fica registrado em `acoes_admin`.

A cortesia é para conceder conta paga a **outras pessoas**. As contas do próprio dono já resolvem isso sozinhas por outro caminho: elas nascem com `plano = ilimitado` por estarem em `ADMIN_ALLOWED_EMAILS` (regra 11.13 do spec), e nenhuma rotina de cobrança as toca — sem precisar de coluna, de clique nem de cliente no Stripe.

---

## 4. As rotinas periódicas

| Rotina | Quando | O que faz |
|---|---|---|
| `POST /api/rotinas/reconciliar-assinaturas` | diária | Relê no Stripe cada conta com `stripe_cliente_id` e corrige divergência. **É esta que salva quando um webhook se perde — e um vai se perder** |
| `POST /api/rotinas/aplicar-rebaixamento` | diária | Executa a seção 3.3 nas contas canceladas com `periodo_fim` vencido |
| `POST /api/rotinas/expurgar-eventos` | semanal | Apaga evento processado com mais de 90 dias. Idempotência não precisa de memória eterna |

A rotina `avisar-trafego` já existe desde o MVP e não muda: a cobrança **lê** a medição de tráfego, não a produz.

Todas protegidas por `CRON_SECRET`, no Vercel Cron.

---

## 5. Nota fiscal — a consequência de cobrar em real

Cobrar em real, como pessoa jurídica brasileira prestando serviço, obriga a **emitir NFS-e**. A Stripe não emite: ela processa pagamento, e nota fiscal de serviço é municipal. Essa parte é do dono, e ele assume o trabalho de olhos abertos.

### O que a plataforma precisa guardar

Os campos obrigatórios **dependem do tipo de tomador**, e a diferença é grande:

| Tomador | Obrigatório | Opcional |
|---|---|---|
| **Pessoa física** | CPF, nome completo | e-mail, telefone, endereço |
| **Pessoa jurídica** | CNPJ, razão social, CEP, endereço, número, bairro, município, estado | e-mail, telefone, complemento, inscrição municipal |

Ou seja: **pessoa física pede dois campos.**

### Como isso vira tela sem virar formulário chato

O checkout pergunta primeiro **"pessoa física ou jurídica?"**, e daí:

- **PF:** CPF e nome completo. Dois campos. Fim.
- **PJ:** CNPJ e CEP, e o resto se preenche sozinho. Consultar CNPJ devolve razão social e endereço; consultar CEP devolve logradouro, bairro, município e estado. Sobra o número para digitar.

Sem consulta automática, PJ seriam oito campos — e oito campos entre a pessoa e o pagamento é onde carrinho morre. Com consulta, são três. **Isso é requisito do épico, não enfeite.**

### Emissão: manual primeiro, automática só quando doer

| Fase | Como | Quando muda |
|---|---|---|
| **1** | A tela `/admin/cobrancas` lista as cobranças do mês com os dados do tomador prontos para copiar. O dono emite pela **Contabilizei**, que ele já usa | Até doer |
| **2** | Emissão automática pela API, disparada pelo webhook de pagamento confirmado | Quando o volume justificar — dezenas de clientes por mês, não antes |

Automatizar NFS-e é um projeto por si: certificado digital A1, numeração de RPS, cancelamento, e a API da prefeitura, que pode ou não estar no padrão nacional. Começar pela fase 1 não fecha porta nenhuma: os dados do tomador já estarão guardados desde o primeiro cliente, que é a parte que dói fazer depois.

Apuração de imposto, DAS, escrituração e regime tributário são do contador. A plataforma guarda dado e ajuda a emitir; não calcula imposto e não substitui contabilidade.

---

## 6. As telas que entram

### `/precos` — pública

Quatro cartões, um por faixa, com limite e preço. Fora dos cartões, explícito: **o plano gratuito não tem marca d'água** e **nenhum livro sai do ar ao deixar de pagar**. São os dois argumentos do produto (decisões C4 e C5).

Visitante deslogado vê "Começar de graça"; autor logado vê "Plano atual" no cartão dele e "Assinar" nos outros.

### `/conta/plano` — do autor

Plano atual em destaque, uso em barra de progresso ("12 de 20 livros"), as quatro faixas em cartões, e o passo de dados fiscais antes do Checkout. Quando já existe assinatura, um link discreto "Gerenciar pagamento" leva ao portal do Stripe.

Estados: confirmando pagamento; pagamento atrasado; após rebaixamento; conta de cortesia (mostra o plano, sem botão de assinar).

**Não desenhar tela de cartão nem de cancelamento** — as duas são do Stripe.

### `/admin/cobrancas` — do admin da plataforma

Lista dos pagamentos do mês, uma linha por cobrança, com tipo de tomador, documento, nome ou razão social, endereço quando PJ, e valor. Cada linha com um botão que copia tudo para colar na Contabilizei. Seletor de mês no topo.

---

## 7. Copy que entra

| Contexto | Texto |
|---|---|
| Limite do plano atingido | "Você chegou ao limite de {n} livros do plano {plano}." (botão: "Ver planos") |
| Assinatura em confirmação | "Estamos confirmando seu pagamento. Isso leva alguns segundos." |
| Pagamento atrasado | "Não conseguimos cobrar sua última fatura. Seus livros continuam no ar." (botão: "Atualizar pagamento") |
| Após rebaixamento | "Sua assinatura terminou. Todos os seus livros continuam publicados — você só não pode adicionar novos até voltar a assinar." |

---

## 8. Variáveis de ambiente que entram

| Variável | Segreda? | Para quê |
|---|---|---|
| `STRIPE_SECRET_KEY` | **sim** | Cobrança. Junto com a chave do Firebase, a credencial mais sensível do projeto |
| `STRIPE_WEBHOOK_SECRET` | **sim** | Verificação da assinatura do webhook |
| `STRIPE_PRICE_ATE_20`, `STRIPE_PRICE_ATE_50`, `STRIPE_PRICE_ATE_100` | não | Ids dos preços no catálogo do Stripe |

Duas armadilhas herdadas do Visão de Produto, e que valem repetir:

1. **Instancie o cliente do Stripe preguiçosamente**, na primeira vez que alguém precisar dele — nunca no topo do módulo. O SDK estoura no construtor quando não recebe chave, e o `next build` abre cada rota para coletar configuração, sem segredo de runtime. Criado no carregamento do módulo, ele quebra todo deploy — e passa no build local, porque lá o `.env` tem a chave.
2. **Fixe a versão da API do Stripe** no construtor. Sem isso, a Stripe promove a conta para uma versão nova e o formato dos objetos muda debaixo do código.

---

## 9. O que testar antes de considerar pronto

- Evento repetido não aplica o efeito duas vezes.
- Assinatura de webhook inválida devolve `400` e não toca em nada.
- Erro no meio do processamento não marca `processado_em`.
- Rebaixamento **não** exclui nem despublica livro nenhum (decisão C5) — o teste que mais importa, porque é a promessa que a página de preços faz.
- Conta com `cortesia = true` não é tocada por nenhuma rotina de cobrança.
- Webhook perdido é corrigido pela reconciliação diária.
- Fluxo completo em modo de teste do Stripe, incluindo cartão que falha.

---

## 10. Perguntas que ficam abertas até o dia de implementar

1. **Conta do Stripe:** a mesma que o Visão de Produto usa, ou uma nova? Reaproveitar simplifica a nota fiscal; separar simplifica ler o faturamento de cada produto.
2. **Franquias de tráfego:** os 20/50/100/200 GB da seção 1 continuam sendo chute calibrado, e são o que segura a fatura do Google.
3. **Plano anual com desconto:** decisão comercial, não técnica. Fora deste desenho.
4. **CNPJ e razão social** que aparecem na cobrança do Stripe e nos termos de uso.
