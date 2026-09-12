// Testes do que o aplicativo de iPhone acrescentou ao servidor (spec-ios).
//
// Três coisas são verificadas aqui, e as três são de segurança:
//   1. o token do app não pode ser forjado nem sobreviver ao prazo;
//   2. a guarda trata o bearer com o mesmo rigor com que trata o cookie — e o
//      isolamento entre contas continua valendo por ele (critérios A.2 e A.3);
//   3. um JWS de assinatura só vale se a cadeia terminar na raiz da Apple.
//
// O terceiro é o que impede a fraude óbvia: gerar a própria cadeia de
// certificados e assinar uma assinatura eterna. O teste usa uma cadeia forjada
// de verdade, guardada em `tests/fixtures/`.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONTA_A,
  CONTA_B,
  bearerInvalido,
  livroFalso,
  mockFirebase,
  mockNextAuth,
  mockNextHeaders,
  semSessao,
  sessaoDoAppDe,
  usuarioFalso,
} from './duplos'

mockNextAuth()
mockNextHeaders()
mockFirebase()

import { assinarTokenDoApp, tokenDoCabecalho, verificarTokenDoApp } from '@/lib/app-auth'
import {
  assinaturaDeTransacao,
  statusDaAssinatura,
  verificarJwsDaApple,
} from '@/lib/appstore'
import * as firestore from '@/lib/firebase/firestore'
import * as storage from '@/lib/firebase/storage'
import { requireAutor, requireDonoDoLivro } from '@/lib/guards'

beforeEach(() => {
  vi.clearAllMocks()
  semSessao()
})

// Nada pode ser lido nem escrito antes de a autorização passar (seção 6).
function nadaFoiTocado() {
  for (const espiao of Object.values(firestore)) {
    if (typeof espiao === 'function' && 'mock' in espiao) {
      expect(vi.mocked(espiao)).not.toHaveBeenCalled()
    }
  }
  for (const espiao of Object.values(storage)) {
    if (typeof espiao === 'function' && 'mock' in espiao) {
      expect(vi.mocked(espiao)).not.toHaveBeenCalled()
    }
  }
}

describe('token do app — spec-ios seção 3', () => {
  it('emite e reconhece o próprio token', () => {
    const { token, expiraEm } = assinarTokenDoApp({ id: CONTA_A.id, email: CONTA_A.email })
    expect(verificarTokenDoApp(token)).toEqual({ id: CONTA_A.id, email: CONTA_A.email })
    // Trinta dias, como a sessão da web (spec seção 6).
    expect(Date.parse(expiraEm) - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
  })

  it('recusa token com o corpo adulterado', () => {
    const { token } = assinarTokenDoApp({ id: CONTA_A.id, email: CONTA_A.email })
    const [cabecalho, , assinatura] = token.split('.')
    const outroCorpo = Buffer.from(
      JSON.stringify({ iss: 'virapagina', aud: 'virapagina-ios', sub: CONTA_B.id, email: CONTA_B.email, exp: 9_999_999_999 }),
    ).toString('base64url')
    expect(verificarTokenDoApp(`${cabecalho}.${outroCorpo}.${assinatura}`)).toBeNull()
  })

  // A vulnerabilidade clássica de JWT: obedecer ao algoritmo que o próprio token
  // declara. Aqui ele é conferido contra o esperado.
  it('recusa token que se diz sem assinatura', () => {
    const cabecalho = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const corpo = Buffer.from(
      JSON.stringify({ iss: 'virapagina', aud: 'virapagina-ios', sub: CONTA_A.id, email: CONTA_A.email, exp: 9_999_999_999 }),
    ).toString('base64url')
    expect(verificarTokenDoApp(`${cabecalho}.${corpo}.`)).toBeNull()
  })

  it('recusa token vencido', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const { token } = assinarTokenDoApp({ id: CONTA_A.id, email: CONTA_A.email })
      vi.setSystemTime(new Date('2026-03-01T00:00:00Z'))
      expect(verificarTokenDoApp(token)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('lê só o esquema Bearer do cabeçalho', () => {
    expect(tokenDoCabecalho('Bearer abc')).toBe('abc')
    expect(tokenDoCabecalho('bearer abc')).toBe('abc')
    expect(tokenDoCabecalho('Basic abc')).toBeNull()
    expect(tokenDoCabecalho(null)).toBeNull()
  })
})

describe('guarda pelo bearer — critérios A.2 e A.3', () => {
  it('autoriza quem chega com token válido do app', async () => {
    sessaoDoAppDe(CONTA_A.id, CONTA_A.email)
    vi.mocked(firestore.garantirUsuario).mockResolvedValue(usuarioFalso({ id: CONTA_A.id }))

    const resultado = await requireAutor()
    expect(resultado.autorizado).toBe(true)
  })

  it('não apaga o nome da conta a cada requisição do app', async () => {
    // O bearer não carrega nome. Mandar `null` faria toda requisição do app
    // sobrescrever o nome que veio do Google no login.
    sessaoDoAppDe(CONTA_A.id, CONTA_A.email)
    vi.mocked(firestore.garantirUsuario).mockResolvedValue(usuarioFalso({ id: CONTA_A.id }))

    await requireAutor()
    expect(vi.mocked(firestore.garantirUsuario).mock.calls[0][0].nome).toBeUndefined()
  })

  it('recusa bearer inválido sem tocar no banco', async () => {
    bearerInvalido()
    const resultado = await requireAutor()
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) expect(resultado.resposta.status).toBe(401)
    nadaFoiTocado()
  })

  // Um bearer apresentado e recusado não pode cair no cookie: seria autenticar
  // por uma credencial diferente da apresentada.
  it('não cai na sessão da web quando o bearer é inválido', async () => {
    bearerInvalido()
    const { sessaoAtualDoTeste } = await import('./duplos')
    sessaoAtualDoTeste.valor = { user: { id: CONTA_B.id, email: CONTA_B.email } }

    const resultado = await requireAutor()
    expect(resultado.autorizado).toBe(false)
    nadaFoiTocado()
  })

  it('devolve 404, nunca 403, para livro de outra conta', async () => {
    sessaoDoAppDe(CONTA_B.id, CONTA_B.email)
    vi.mocked(firestore.garantirUsuario).mockResolvedValue(
      usuarioFalso({ id: CONTA_B.id, email: CONTA_B.email, handle: 'bruno' }),
    )
    vi.mocked(firestore.buscarLivroPorId).mockResolvedValue(livroFalso({ dono_id: CONTA_A.id }))

    const resultado = await requireDonoDoLivro('livro-1')
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) expect(resultado.resposta.status).toBe(404)
  })
})

describe('assinatura da App Store — spec-ios seção 5', () => {
  const transacao = {
    bundleId: 'app.br.virapagina.ios',
    productId: 'app.br.virapagina.ilimitado.mensal',
    originalTransactionId: 'abc-123',
    expiresDate: Date.parse('2026-10-12T00:00:00Z'),
    environment: 'Production',
  }
  const agora = Date.parse('2026-09-12T00:00:00Z')

  it('assinatura dentro do prazo é ativa', () => {
    expect(statusDaAssinatura(transacao, null, agora)).toBe('ativa')
  })

  it('reembolso derruba na hora, mesmo com prazo restante', () => {
    expect(
      statusDaAssinatura({ ...transacao, revocationDate: agora }, null, agora),
    ).toBe('cancelada')
  })

  // Cartão vencido não é cancelamento: a Apple ainda está tentando cobrar.
  it('nova tentativa de cobrança dentro da tolerância é em_atraso', () => {
    const vencida = { ...transacao, expiresDate: agora - 1000 }
    expect(
      statusDaAssinatura(vencida, { isInBillingRetryPeriod: true, gracePeriodExpiresDate: agora + 86_400_000 }, agora),
    ).toBe('em_atraso')
  })

  it('fora do prazo e sem tolerância é expirada', () => {
    expect(statusDaAssinatura({ ...transacao, expiresDate: agora - 1000 }, null, agora)).toBe('expirada')
  })

  it('recusa JWS de outro app e de outro produto', () => {
    expect(assinaturaDeTransacao({ ...transacao, bundleId: 'com.outro.app' }, null)).toBeNull()
    expect(assinaturaDeTransacao({ ...transacao, productId: 'outro.produto' }, null)).toBeNull()
  })

  it('registra o ambiente da compra em vez de recusá-la', () => {
    // A App Review compra em sandbox contra o servidor de produção: recusar por
    // ambiente seria ser rejeitado por defeito nosso (regra iOS 10.7).
    const sandbox = assinaturaDeTransacao({ ...transacao, environment: 'Sandbox' }, null)
    expect(sandbox?.ambiente).toBe('sandbox')
  })

  // O teste que sustenta a regra iOS 10.5. A cadeia do arquivo é legítima do
  // ponto de vista criptográfico — três certificados que assinam uns aos outros
  // e um JWS assinado pela folha. O que ela não tem é a raiz da Apple.
  it('recusa JWS de cadeia que não termina na raiz da Apple', () => {
    const forjado = readFileSync(
      path.join(process.cwd(), 'tests/fixtures/jws-de-cadeia-forjada.txt'),
      'utf8',
    ).trim()
    expect(verificarJwsDaApple(forjado)).toBeNull()
  })

  it('recusa JWS malformado, sem cadeia e com algoritmo trocado', () => {
    expect(verificarJwsDaApple('nao.e.um.jws')).toBeNull()
    expect(verificarJwsDaApple('')).toBeNull()
    const semCadeia = `${Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64url')}.e30.x`
    expect(verificarJwsDaApple(semCadeia)).toBeNull()
  })
})
