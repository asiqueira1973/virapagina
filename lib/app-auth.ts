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
import { env, envOuNulo } from '@/lib/env'

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

const JWKS_DA_APPLE = 'https://appleid.apple.com/auth/keys'
const EMISSOR_DA_APPLE = 'https://appleid.apple.com'

interface ChaveJwk {
  kid: string
  n: string
  e: string
  kty: string
  alg?: string
}

// Cache das chaves públicas de quem emite os tokens, por endereço.
//
// Elas rodam de tempos em tempos, e tanto o Google quanto a Apple mandam o prazo
// no `Cache-Control`. Buscar a cada login seria uma ida à rede dentro do caminho
// crítico; nunca buscar quebraria o app no dia da rotação.
const chavesEmCache = new Map<string, { chaves: ChaveJwk[]; valeAte: number }>()

async function chavesPublicas(url: string): Promise<ChaveJwk[]> {
  const guardado = chavesEmCache.get(url)
  if (guardado && guardado.valeAte > Date.now()) return guardado.chaves

  const resposta = await fetch(url)
  if (!resposta.ok) throw new Error(`JWKS ${url} respondeu ${resposta.status}`)
  const corpo = (await resposta.json()) as { keys: ChaveJwk[] }

  // Respeita o prazo que o próprio emissor manda, com um piso de 5 minutos para
  // o caso de uma resposta sem cabeçalho.
  const controle = resposta.headers.get('cache-control') ?? ''
  const maxAge = Number(/max-age=(\d+)/.exec(controle)?.[1] ?? 0)
  const chaves = corpo.keys ?? []
  chavesEmCache.set(url, { chaves, valeAte: Date.now() + Math.max(maxAge, 300) * 1000 })
  return chaves
}

// Confere a assinatura RS256 de um JWT contra o JWKS do emissor e devolve o
// conteúdo. Não olha `iss`, `aud` nem prazo — isso é de quem chama, porque cada
// emissor tem as suas regras.
async function conteudoAssinado(
  jwt: string,
  jwks: string,
): Promise<Record<string, unknown> | null> {
  const partes = jwt.split('.')
  if (partes.length !== 3) return null
  const [cabecalho, corpo, assinatura] = partes

  const cabecalhoLido = JSON.parse(deBase64url(cabecalho).toString()) as {
    alg?: string
    kid?: string
  }
  // Como sempre: o algoritmo é conferido, não obedecido.
  if (cabecalhoLido.alg !== 'RS256' || !cabecalhoLido.kid) return null

  const chave = (await chavesPublicas(jwks)).find((candidata) => candidata.kid === cabecalhoLido.kid)
  if (!chave) return null

  // O `node:crypto` monta a chave pública direto do JWK — não é preciso
  // converter para PEM à mão.
  const publica = createPublicKey({ key: chave as unknown as JsonWebKey, format: 'jwk' })
  const conferidor = createVerify('RSA-SHA256')
  conferidor.update(`${cabecalho}.${corpo}`)
  if (!conferidor.verify(publica, deBase64url(assinatura))) return null

  return JSON.parse(deBase64url(corpo).toString()) as Record<string, unknown>
}

export interface IdentidadeDoGoogle {
  sub: string
  email: string
  nome: string | null
}

export interface IdentidadeDaApple {
  sub: string
  // Nulo no login seguinte ao primeiro: a Apple só manda o e-mail de novo
  // enquanto quiser. Quem chama usa o que já está gravado na conta.
  email: string | null
}

// Confere o `id_token` que o app trouxe do Google e devolve quem ele identifica.
//
// Quatro perguntas, e nenhuma é dispensável:
//   1. A assinatura bate com uma chave pública atual do emissor?
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

  try {
    const dados = await conteudoAssinado(idToken, JWKS_DO_GOOGLE)
    if (!dados) return null

    const iss = dados.iss as string | undefined
    const sub = dados.sub as string | undefined
    const email = dados.email as string | undefined

    if (!iss || !EMISSORES_DO_GOOGLE.includes(iss)) return null
    if (dados.aud !== publicoEsperado) return null
    if (!sub || !email) return null
    // Conta Google com e-mail não verificado não existe na prática, mas o campo
    // vem no token e ignorá-lo seria aceitar um e-mail que ninguém provou.
    if (dados.email_verified === false || dados.email_verified === 'false') return null
    if (!dentroDoPrazo(dados.exp)) return null

    return { sub, email, nome: (dados.name as string | undefined) ?? null }
  } catch {
    return null
  }
}

// Confere o `identityToken` do Login com Apple (spec-ios regra iOS 10.12).
//
// Mesmas quatro perguntas do Google, com um `aud` diferente: no fluxo nativo ele
// é o **bundle id** do app, não um client OAuth.
//
// Duas coisas são próprias da Apple e mudam o desenho:
//
//   - O `sub` é estável por **time de desenvolvimento**, não por conta Apple
//     global. Ele identifica a pessoa neste app e nos outros do mesmo time — e é
//     por isso que serve de id de conta.
//   - O e-mail pode ser um relay `@privaterelay.appleid.com`, e pode **não vir**
//     em logins seguintes. Quem chama precisa aguentar a ausência: a conta já
//     existe e o e-mail dela já está gravado.
export async function verificarIdentityTokenDaApple(
  identityToken: string,
): Promise<IdentidadeDaApple | null> {
  const publicoEsperado = env('APP_STORE_BUNDLE_ID', 'app.br.virapagina.ios')

  try {
    const dados = await conteudoAssinado(identityToken, JWKS_DA_APPLE)
    if (!dados) return null

    if (dados.iss !== EMISSOR_DA_APPLE) return null
    if (dados.aud !== publicoEsperado) return null
    const sub = dados.sub as string | undefined
    if (!sub) return null
    if (!dentroDoPrazo(dados.exp)) return null

    // E-mail não verificado não vira conta: seria aceitar um endereço que
    // ninguém provou. Ausente é outra coisa — é o login seguinte, e é previsto.
    const verificado = dados.email_verified
    const email =
      verificado === false || verificado === 'false'
        ? null
        : ((dados.email as string | undefined) ?? null)

    return { sub, email }
  } catch {
    return null
  }
}

function dentroDoPrazo(exp: unknown): boolean {
  const agora = Math.floor(Date.now() / 1000)
  return typeof exp === 'number' && exp + TOLERANCIA_SEGUNDOS >= agora
}

// O id da conta de quem entra pela Apple (decisão 15.2 do spec-ios).
//
// **Prefixado, e as contas são separadas.** Quem entra com o Google e quem entra
// com a Apple viram duas contas, mesmo sendo a mesma pessoa — porque não há como
// provar que são. O relay privado da Apple entrega um endereço diferente do
// Google, então casar por e-mail ou duplica a pessoa de qualquer jeito, ou
// aceita um endereço que ninguém provou ser dela.
//
// O prefixo existe para que um `sub` da Apple nunca possa colidir com um `sub`
// do Google, que é o id das contas que já existem. Hoje os formatos são
// diferentes e a colisão seria improvável; improvável não é o mesmo que
// impossível, e o custo de errar aqui é uma pessoa entrar na conta de outra.
export function idDaContaApple(sub: string): string {
  return `apple:${sub}`
}
