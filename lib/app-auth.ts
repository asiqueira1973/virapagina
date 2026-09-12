// A sessão do aplicativo de iPhone (spec-ios seção 3).
//
// O app não tem cookie e não fala Auth.js: ele traz um `id_token` do Google,
// recebe um token nosso e o manda em `Authorization: Bearer` daí em diante.
// Este arquivo é quem emite e quem confere os dois.
//
// **Sem biblioteca.** Nem `jose`, nem `jsonwebtoken`: o que é preciso aqui são
// duas assinaturas (HMAC-SHA256 para o nosso token, RSA-SHA256 para o do
// Google) e o `node:crypto` faz as duas. Uma dependência a menos numa camada de
// autenticação é uma atualização de segurança a menos para acompanhar.
//
// Este arquivo é de Node, não do Edge — como `lib/guards.ts` e pelo mesmo
// motivo. O middleware não passa por aqui.
import { createHmac, createPublicKey, createVerify, timingSafeEqual } from 'node:crypto'
import type { JsonWebKey } from 'node:crypto'
import { envOuNulo } from '@/lib/env'

// Quem somos e para quem o token vale. Ficam no token para que ele não seja
// confundido com outro JWT qualquer assinado com o mesmo segredo.
const EMISSOR = 'virapagina'
const PUBLICO = 'virapagina-ios'

// Trinta dias, o mesmo da sessão da web (spec seção 6). Não há refresh token
// nosso: um mês sem abrir o app custa um login, e a alternativa seria guardar um
// segredo de vida longa no aparelho.
const VALIDADE_SEGUNDOS = 30 * 24 * 60 * 60

// Tolerância de relógio ao conferir `exp` e `iat`. Aparelho com hora errada é
// caso real, e um minuto é o bastante para não recusar quem tem direito.
const TOLERANCIA_SEGUNDOS = 60

export interface DonoDoToken {
  id: string
  email: string
}

function base64url(dados: Buffer | string): string {
  return Buffer.from(dados).toString('base64url')
}

function deBase64url(texto: string): Buffer {
  return Buffer.from(texto, 'base64url')
}

// Compara duas assinaturas em tempo constante. `timingSafeEqual` explode quando
// os tamanhos diferem, e tamanho diferente já é assinatura errada.
function iguais(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

function segredo(): string {
  const valor = envOuNulo('NEXTAUTH_SECRET')
  // O mesmo segredo da sessão da web: um segredo a menos para guardar, e
  // trocá-lo derruba as duas sessões ao mesmo tempo, que é o comportamento que
  // se espera de uma troca de segredo.
  if (!valor) throw new Error('NEXTAUTH_SECRET não configurado')
  return valor
}

// ---------------------------------------------------------------------------
// O nosso token
// ---------------------------------------------------------------------------

// Emite o token do app para uma conta que já foi identificada pelo Google.
//
// O `sub` é o mesmo `sub` do Google, que é o id do documento em `usuarios`
// (spec seção 6) — é isso que faz app e site serem a mesma conta.
export function assinarTokenDoApp(dono: DonoDoToken): { token: string; expiraEm: string } {
  const agora = Math.floor(Date.now() / 1000)
  const expiraEm = agora + VALIDADE_SEGUNDOS

  const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const corpo = base64url(
    JSON.stringify({
      iss: EMISSOR,
      aud: PUBLICO,
      sub: dono.id,
      email: dono.email,
      iat: agora,
      exp: expiraEm,
    }),
  )
  const assinatura = createHmac('sha256', segredo()).update(`${cabecalho}.${corpo}`).digest('base64url')

  return { token: `${cabecalho}.${corpo}.${assinatura}`, expiraEm: new Date(expiraEm * 1000).toISOString() }
}

// Confere o token do app e devolve quem ele identifica, ou null.
//
// Devolve null para tudo — formato errado, assinatura errada, token vencido,
// algoritmo trocado. Quem chama transforma isso em 401 e o app apaga o token e
// volta para a tela de entrar; nenhuma dessas causas rende mensagem diferente
// para quem está do outro lado.
//
// O `alg` é conferido contra o valor esperado em vez de ser obedecido: aceitar o
// algoritmo que o token declara é a vulnerabilidade clássica de JWT (`alg: none`
// e a confusão HS/RS).
export function verificarTokenDoApp(token: string | null | undefined): DonoDoToken | null {
  if (!token) return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  const [cabecalho, corpo, assinatura] = partes

  try {
    const cabecalhoLido = JSON.parse(deBase64url(cabecalho).toString()) as { alg?: string }
    if (cabecalhoLido.alg !== 'HS256') return null

    const esperada = createHmac('sha256', segredo()).update(`${cabecalho}.${corpo}`).digest()
    if (!iguais(esperada, deBase64url(assinatura))) return null

    const dados = JSON.parse(deBase64url(corpo).toString()) as {
      iss?: string
      aud?: string
      sub?: string
      email?: string
      exp?: number
    }
    if (dados.iss !== EMISSOR || dados.aud !== PUBLICO) return null
    if (!dados.sub || !dados.email) return null

    const agora = Math.floor(Date.now() / 1000)
    if (typeof dados.exp !== 'number' || dados.exp + TOLERANCIA_SEGUNDOS < agora) return null

    return { id: dados.sub, email: dados.email }
  } catch {
    return null
  }
}

// Lê o token do cabeçalho `Authorization`. Aceita só o esquema Bearer.
export function tokenDoCabecalho(autorizacao: string | null | undefined): string | null {
  if (!autorizacao) return null
  const [esquema, valor] = autorizacao.split(' ')
  if (!valor || esquema.toLowerCase() !== 'bearer') return null
  return valor.trim() || null
}

// ---------------------------------------------------------------------------
// O token do Google
// ---------------------------------------------------------------------------

const JWKS_DO_GOOGLE = 'https://www.googleapis.com/oauth2/v3/certs'
const EMISSORES_DO_GOOGLE = ['https://accounts.google.com', 'accounts.google.com']

interface ChaveJwk {
  kid: string
  n: string
  e: string
  kty: string
  alg?: string
}

// Cache das chaves públicas do Google.
//
// Elas rodam de tempos em tempos e o Google manda o prazo no `Cache-Control`.
// Buscar a cada login seria uma ida à rede dentro do caminho crítico do login;
// nunca buscar quebraria o app no dia da rotação.
let chavesEmCache: { chaves: ChaveJwk[]; valeAte: number } | null = null

async function chavesDoGoogle(): Promise<ChaveJwk[]> {
  if (chavesEmCache && chavesEmCache.valeAte > Date.now()) return chavesEmCache.chaves

  const resposta = await fetch(JWKS_DO_GOOGLE)
  if (!resposta.ok) throw new Error(`JWKS do Google respondeu ${resposta.status}`)
  const corpo = (await resposta.json()) as { keys: ChaveJwk[] }

  // Respeita o prazo que o próprio Google manda, com um piso de 5 minutos para
  // o caso de uma resposta sem cabeçalho.
  const controle = resposta.headers.get('cache-control') ?? ''
  const maxAge = Number(/max-age=(\d+)/.exec(controle)?.[1] ?? 0)
  chavesEmCache = {
    chaves: corpo.keys ?? [],
    valeAte: Date.now() + Math.max(maxAge, 300) * 1000,
  }
  return chavesEmCache.chaves
}

export interface IdentidadeDoGoogle {
  sub: string
  email: string
  nome: string | null
}

// Confere o `id_token` que o app trouxe do Google e devolve quem ele identifica.
//
// Quatro perguntas, e nenhuma é dispensável:
//   1. A assinatura bate com uma chave pública atual do Google?
//   2. Quem emitiu foi o Google?
//   3. O token foi emitido **para o nosso app** (`aud`)? Sem isso, um id_token
//      legítimo obtido por qualquer outro aplicativo entraria na conta da pessoa
//      aqui dentro — é o ataque que a checagem de `aud` existe para impedir.
//   4. Ainda está no prazo?
//
// O `aud` esperado é o client OAuth **do tipo iOS**, que é outro id que o da web.
export async function verificarIdTokenDoGoogle(
  idToken: string,
): Promise<IdentidadeDoGoogle | null> {
  const publicoEsperado = envOuNulo('GOOGLE_OAUTH_IOS_CLIENT_ID')
  if (!publicoEsperado) throw new Error('GOOGLE_OAUTH_IOS_CLIENT_ID não configurado')

  const partes = idToken.split('.')
  if (partes.length !== 3) return null
  const [cabecalho, corpo, assinatura] = partes

  try {
    const cabecalhoLido = JSON.parse(deBase64url(cabecalho).toString()) as {
      alg?: string
      kid?: string
    }
    if (cabecalhoLido.alg !== 'RS256' || !cabecalhoLido.kid) return null

    const chave = (await chavesDoGoogle()).find((candidata) => candidata.kid === cabecalhoLido.kid)
    if (!chave) return null

    // O `node:crypto` monta a chave pública direto do JWK — não é preciso
    // converter para PEM à mão.
    const publica = createPublicKey({ key: chave as unknown as JsonWebKey, format: 'jwk' })
    const conferidor = createVerify('RSA-SHA256')
    conferidor.update(`${cabecalho}.${corpo}`)
    if (!conferidor.verify(publica, deBase64url(assinatura))) return null

    const dados = JSON.parse(deBase64url(corpo).toString()) as {
      iss?: string
      aud?: string
      sub?: string
      email?: string
      email_verified?: boolean | string
      name?: string
      exp?: number
    }

    if (!dados.iss || !EMISSORES_DO_GOOGLE.includes(dados.iss)) return null
    if (dados.aud !== publicoEsperado) return null
    if (!dados.sub || !dados.email) return null
    // Conta Google com e-mail não verificado não existe na prática, mas o campo
    // vem no token e ignorá-lo seria aceitar um e-mail que ninguém provou.
    if (dados.email_verified === false || dados.email_verified === 'false') return null

    const agora = Math.floor(Date.now() / 1000)
    if (typeof dados.exp !== 'number' || dados.exp + TOLERANCIA_SEGUNDOS < agora) return null

    return { sub: dados.sub, email: dados.email, nome: dados.name ?? null }
  } catch {
    return null
  }
}
