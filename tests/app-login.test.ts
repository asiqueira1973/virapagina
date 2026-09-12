// A rota de sessão do app, com dois provedores (spec-ios seção 3).
//
// O que este arquivo guarda não é a criptografia — essa está em
// `app-ios.test.ts` — e sim o **roteamento entre os provedores**, que é onde
// mora o risco de quebrar quem já tem o app instalado: `id_token` continua
// significando Google, e o campo novo da Apple entra ao lado, sem trocar o
// contrato que o primeiro build enviado à App Store já usa.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTA_A, mockFirebase, mockNextAuth, mockNextHeaders, usuarioFalso } from './duplos'

mockNextAuth()
mockNextHeaders()
mockFirebase()

// Só os dois conferidores de token são substituídos: o resto de `app-auth` —
// inclusive o prefixo do id da Apple e a emissão do nosso token — continua real.
vi.mock('@/lib/app-auth', async (original) => ({
  ...(await original<typeof import('@/lib/app-auth')>()),
  verificarIdTokenDoGoogle: vi.fn(),
  verificarIdentityTokenDaApple: vi.fn(),
}))

import { idDaContaApple, verificarIdTokenDoGoogle, verificarIdentityTokenDaApple, verificarTokenDoApp } from '@/lib/app-auth'
import * as firestore from '@/lib/firebase/firestore'

function pedido(corpo: unknown) {
  return new Request('https://virapagina.app.br/api/app/sessao', {
    method: 'POST',
    body: JSON.stringify(corpo),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(firestore.garantirUsuario).mockImplementation(async ({ id, email }) =>
    usuarioFalso({ id, email }),
  )
  vi.mocked(firestore.contarLivrosDoDono).mockResolvedValue(0)
  vi.mocked(firestore.buscarUsuarioPorId).mockResolvedValue(null)
})

describe('entrar pelo app — critérios A.1 e B.5', () => {
  it('o campo antigo continua significando Google', async () => {
    vi.mocked(verificarIdTokenDoGoogle).mockResolvedValue({
      sub: CONTA_A.id,
      email: CONTA_A.email,
      nome: 'Ana',
    })
    const { POST } = await import('@/app/api/app/sessao/route')
    const corpo = await (await POST(pedido({ id_token: 'do-google' }))).json()

    expect(corpo.conta.id).toBe(CONTA_A.id)
    expect(verificarTokenDoApp(corpo.token)).toEqual({ id: CONTA_A.id, email: CONTA_A.email })
    // A conta criada pelo app nasce gratuita (regra iOS 10.1).
    expect(vi.mocked(firestore.garantirUsuario).mock.calls[0][0].origem).toBe('app')
  })

  it('a conta da Apple é outra conta, com id prefixado', async () => {
    vi.mocked(verificarIdentityTokenDaApple).mockResolvedValue({
      sub: '000123.abc',
      email: 'privado@privaterelay.appleid.com',
    })
    const { POST } = await import('@/app/api/app/sessao/route')
    const corpo = await (await POST(pedido({ apple_identity_token: 'da-apple', nome: 'Ana' }))).json()

    expect(corpo.conta.id).toBe('apple:000123.abc')
    expect(idDaContaApple('000123.abc')).toBe('apple:000123.abc')
  })

  // O caso que derrubaria quem entrou uma vez: a Apple só manda o e-mail na
  // primeira autorização, e a conta já tem o dela.
  it('login seguinte da Apple, sem e-mail no token, usa o que já está gravado', async () => {
    vi.mocked(verificarIdentityTokenDaApple).mockResolvedValue({ sub: '000123.abc', email: null })
    vi.mocked(firestore.buscarUsuarioPorId).mockResolvedValue(
      usuarioFalso({ id: 'apple:000123.abc', email: 'ja-gravado@exemplo.com', nome: 'Ana' }),
    )
    const { POST } = await import('@/app/api/app/sessao/route')
    const resposta = await POST(pedido({ apple_identity_token: 'da-apple' }))

    expect(resposta.status).toBe(200)
    expect(vi.mocked(firestore.garantirUsuario).mock.calls[0][0].email).toBe('ja-gravado@exemplo.com')
    // Nome ausente, não nulo: a conta já tem o dela e mandar `null` o apagaria.
    expect(vi.mocked(firestore.garantirUsuario).mock.calls[0][0].nome).toBeUndefined()
  })

  it('primeira autorização da Apple sem e-mail nenhum não vira conta', async () => {
    vi.mocked(verificarIdentityTokenDaApple).mockResolvedValue({ sub: '000999.xyz', email: null })
    const { POST } = await import('@/app/api/app/sessao/route')
    const resposta = await POST(pedido({ apple_identity_token: 'da-apple' }))

    expect(resposta.status).toBe(401)
    expect(vi.mocked(firestore.garantirUsuario)).not.toHaveBeenCalled()
  })

  it('token recusado pelo provedor não cria conta nenhuma', async () => {
    vi.mocked(verificarIdTokenDoGoogle).mockResolvedValue(null)
    const { POST } = await import('@/app/api/app/sessao/route')
    const resposta = await POST(pedido({ id_token: 'forjado' }))

    expect(resposta.status).toBe(401)
    expect(vi.mocked(firestore.garantirUsuario)).not.toHaveBeenCalled()
  })

  it('corpo sem token nenhum devolve 401 sem tocar no banco', async () => {
    const { POST } = await import('@/app/api/app/sessao/route')
    const resposta = await POST(pedido({}))

    expect(resposta.status).toBe(401)
    expect(vi.mocked(firestore.garantirUsuario)).not.toHaveBeenCalled()
  })
})
