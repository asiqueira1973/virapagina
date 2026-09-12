// Verificação do que a App Store assina (spec-ios seção 5).
//
// Tudo que vem da Apple — a transação que o app manda depois da compra e a
// notificação que o servidor da Apple manda sozinho — é um **JWS**: três partes
// separadas por ponto, assinadas em ES256, com a cadeia de certificados inteira
// no cabeçalho, em `x5c`.
//
// Verificar isso é o que separa uma assinatura de verdade de um JSON inventado
// por quem apontou o app para um proxy (princípio 10 do spec-ios). São quatro
// perguntas, e nenhuma pode ser pulada:
//
//   1. A folha da cadeia assinou este JWS?
//   2. A folha foi emitida pela intermediária, e a intermediária pela raiz?
//   3. A raiz é **a** Apple Root CA - G3, byte a byte — não uma que só se chama
//      assim?
//   4. Os três certificados estão dentro da validade?
//
// Sem o passo 3, qualquer pessoa gera a própria cadeia e assina o que quiser: é
// o erro clássico de quem valida "a cadeia" sem ancorá-la em nada.
//
// Sem biblioteca, de novo: `node:crypto` faz X.509 e ECDSA. A alternativa seria
// o SDK da Apple, que traz dezenas de dependências para fazer isto aqui.
import { X509Certificate, createVerify } from 'node:crypto'
import { env } from '@/lib/env'
import type { Assinatura, StatusDaAssinatura } from '@/types/livro'

// A âncora de confiança. Baixada de
// https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
// SHA-256: 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
//
// Vai no código, e não numa variável de ambiente, de propósito: âncora de
// confiança configurável é âncora que alguém troca sem perceber. Ela vence em
// 2039.
const RAIZ_DA_APPLE = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`

// O produto único da seção 5 do spec-ios. Um JWS de outro produto — de outro app
// do mesmo desenvolvedor, por exemplo — não promove ninguém aqui.
export const PRODUTO_ASSINATURA = 'app.br.virapagina.assinatura.mensal'

// O bundle id do app. JWS com outro bundle é de outro aplicativo.
export function bundleIdEsperado(): string {
  return env('APP_STORE_BUNDLE_ID', 'app.br.virapagina.ios')
}

// O que interessa da transação assinada pela Apple. O JWS traz muito mais; o que
// não é lido aqui não influencia decisão nenhuma.
export interface TransacaoDaApple {
  bundleId?: string
  productId?: string
  originalTransactionId?: string
  expiresDate?: number
  revocationDate?: number
  environment?: string
  type?: string
}

export interface RenovacaoDaApple {
  autoRenewStatus?: number
  isInBillingRetryPeriod?: boolean
  gracePeriodExpiresDate?: number
  environment?: string
}

export interface NotificacaoDaApple {
  notificationType?: string
  subtype?: string
  data?: {
    bundleId?: string
    environment?: string
    signedTransactionInfo?: string
    signedRenewalInfo?: string
  }
}

function deBase64url(texto: string): Buffer {
  return Buffer.from(texto, 'base64url')
}

// Confere um certificado contra quem deveria tê-lo emitido: o nome do emissor e
// a assinatura, que é a parte que importa.
function emitidoPor(certificado: X509Certificate, emissor: X509Certificate): boolean {
  return certificado.checkIssued(emissor) && certificado.verify(emissor.publicKey)
}

function dentroDaValidade(certificado: X509Certificate, agora: number): boolean {
  return Date.parse(certificado.validFrom) <= agora && agora <= Date.parse(certificado.validTo)
}

// Verifica um JWS da Apple e devolve o conteúdo, ou null.
//
// Devolve null para toda falha, sem distinguir: quem chama transforma isso numa
// resposta só, e detalhar qual passo falhou só ajudaria quem está tentando
// forjar.
export function verificarJwsDaApple<T>(jws: string): T | null {
  try {
    const partes = jws.split('.')
    if (partes.length !== 3) return null
    const [cabecalho, corpo, assinatura] = partes

    const cabecalhoLido = JSON.parse(deBase64url(cabecalho).toString()) as {
      alg?: string
      x5c?: string[]
    }
    // ES256 é o que a Apple usa. Como sempre, o algoritmo é conferido, não
    // obedecido.
    if (cabecalhoLido.alg !== 'ES256') return null
    if (!cabecalhoLido.x5c || cabecalhoLido.x5c.length < 3) return null

    const [folha, intermediaria, raiz] = cabecalhoLido.x5c
      .slice(0, 3)
      .map((certificado) => new X509Certificate(Buffer.from(certificado, 'base64')))

    const agora = Date.now()
    if (![folha, intermediaria, raiz].every((certificado) => dentroDaValidade(certificado, agora))) {
      return null
    }

    // A âncora: a raiz apresentada tem de ser byte a byte a da Apple. Comparar
    // nome ou emissor não serve — os dois são escolhidos por quem forja.
    if (!raiz.raw.equals(new X509Certificate(RAIZ_DA_APPLE).raw)) return null
    if (!emitidoPor(intermediaria, raiz)) return null
    if (!emitidoPor(folha, intermediaria)) return null

    // A assinatura do JWS em si, com a chave pública da folha. `ieee-p1363` é o
    // formato de assinatura que o JWS usa (r e s concatenados); o padrão do
    // Node é DER, e sem este detalhe a conferência falha em tudo que é legítimo.
    const conferidor = createVerify('SHA256')
    conferidor.update(`${cabecalho}.${corpo}`)
    const valida = conferidor.verify(
      { key: folha.publicKey, dsaEncoding: 'ieee-p1363' },
      deBase64url(assinatura),
    )
    if (!valida) return null

    return JSON.parse(deBase64url(corpo).toString()) as T
  } catch {
    return null
  }
}

// Traduz o que a Apple diz para o estado que o nosso produto entende
// (spec-ios seção 4).
//
// A ordem das perguntas é a regra de negócio:
//   1. Reembolsada ou revogada (`revocationDate`) acaba na hora, com ou sem
//      prazo restante — dinheiro devolvido não compra acesso.
//   2. Dentro do prazo pago é ativa. Inclui quem desligou a renovação
//      automática: a pessoa pagou o mês, e o mês é dela.
//   3. Fora do prazo, mas em nova tentativa de cobrança dentro do período de
//      tolerância, é `em_atraso` — cartão vencido não é cancelamento.
//   4. O resto é expirada.
export function statusDaAssinatura(
  transacao: TransacaoDaApple,
  renovacao: RenovacaoDaApple | null,
  agora = Date.now(),
): StatusDaAssinatura {
  if (typeof transacao.revocationDate === 'number') return 'cancelada'
  if (typeof transacao.expiresDate === 'number' && transacao.expiresDate > agora) return 'ativa'
  if (
    renovacao?.isInBillingRetryPeriod &&
    typeof renovacao.gracePeriodExpiresDate === 'number' &&
    renovacao.gracePeriodExpiresDate > agora
  ) {
    return 'em_atraso'
  }
  return 'expirada'
}

// Monta o objeto que vai para o Firestore a partir da transação verificada.
// Devolve null quando o JWS é de outro app ou de outro produto — os dois casos
// em que ele é legítimo e ainda assim não vale nada aqui.
export function assinaturaDeTransacao(
  transacao: TransacaoDaApple,
  renovacao: RenovacaoDaApple | null,
): Assinatura | null {
  if (transacao.bundleId !== bundleIdEsperado()) return null
  if (transacao.productId !== PRODUTO_ASSINATURA) return null
  if (!transacao.originalTransactionId) return null

  return {
    loja: 'app_store',
    produto_id: transacao.productId,
    transacao_original_id: transacao.originalTransactionId,
    status: statusDaAssinatura(transacao, renovacao),
    expira_em:
      typeof transacao.expiresDate === 'number'
        ? new Date(transacao.expiresDate).toISOString()
        : null,
    // Sandbox é aceito e **registrado**, não recusado: a App Review compra em
    // sandbox contra o servidor de produção, e recusar seria ser rejeitado por
    // um defeito que só existe no nosso lado (regra iOS 10.7). O campo fica no
    // documento para que uma conta promovida por compra de teste seja
    // reconhecível no console — e só quem tem um sandbox tester criado por nós
    // consegue gerar uma.
    ambiente: transacao.environment === 'Sandbox' ? 'sandbox' : 'producao',
    // Reescrito pela camada de dados na gravação; aqui é só para o tipo fechar.
    atualizado_em: new Date().toISOString(),
  }
}
