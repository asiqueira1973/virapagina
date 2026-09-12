// POST /api/app/sessao — troca o token do provedor pelo token do app
// (spec-ios seção 3, critérios A.1 e B.5).
//
// É a única rota do produto que autentica alguém a partir do zero: ela roda
// **sem** guarda, porque é ela que cria a sessão. O que faz o papel da guarda é a
// verificação do id_token — assinatura, emissor, público e prazo — em
// `lib/app-auth.ts`.
//
// Depois daqui, toda rota que o app chama passa por `requireAutor()` como
// qualquer requisição do navegador.
//
// Dois provedores, dois campos no corpo, e **um deles é o antigo**: `id_token`
// continua significando Google, como no primeiro build. Trocar isso por um
// campo `provedor` seria mais bonito e derrubaria o login de quem ainda não
// atualizou o app — a rota é contrato público a partir do primeiro envio.
import { NextResponse } from 'next/server'
import {
  assinarTokenDoApp,
  idDaContaApple,
  verificarIdTokenDoGoogle,
  verificarIdentityTokenDaApple,
} from '@/lib/app-auth'
import { contaParaOApp } from '@/lib/app-conta'
import { buscarUsuarioPorId, garantirUsuario } from '@/lib/firebase/firestore'

export async function POST(request: Request) {
  try {
    const corpo = await request.json()
    const idToken = typeof corpo?.id_token === 'string' ? corpo.id_token : ''
    const tokenDaApple =
      typeof corpo?.apple_identity_token === 'string' ? corpo.apple_identity_token : ''

    const quem = idToken
      ? await identidadeDoGoogle(idToken)
      : tokenDaApple
        ? await identidadeDaApple(tokenDaApple, corpo?.nome)
        : null

    if (!quem) {
      return NextResponse.json({ erro: 'Não foi possível entrar. Tente novamente.' }, { status: 401 })
    }

    // `origem: 'app'` só tem efeito quando a conta está nascendo (regra iOS
    // 10.1): conta criada aqui nasce gratuita, com 5 livros, mesmo com a chave
    // de early adopter ligada. Quem já existe entra com o plano que tem —
    // inclusive ilimitado, sem paywall (regra iOS 10.2).
    const usuario = await garantirUsuario({
      id: quem.id,
      email: quem.email,
      nome: quem.nome,
      origem: 'app',
    })

    const { token, expiraEm } = assinarTokenDoApp({ id: usuario.id, email: usuario.email })

    return NextResponse.json({
      token,
      expira_em: expiraEm,
      conta: await contaParaOApp(usuario),
    })
  } catch (erro) {
    console.error('Falha ao abrir sessão do app:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}

interface QuemEntrou {
  id: string
  email: string
  // Ausente, e não nulo, quando o provedor não mandou o nome: `garantirUsuario`
  // trata os dois de um jeito diferente, e `null` apagaria o nome já gravado.
  nome?: string | null
}

async function identidadeDoGoogle(idToken: string): Promise<QuemEntrou | null> {
  const identidade = await verificarIdTokenDoGoogle(idToken)
  if (!identidade) return null
  return { id: identidade.sub, email: identidade.email, nome: identidade.nome }
}

// O Login com Apple, com duas particularidades que o Google não tem.
//
// **O e-mail só vem no primeiro login.** Nas vezes seguintes a Apple pode omiti-lo,
// e a conta já tem o dela gravado — buscar antes de decidir é o que evita
// recusar quem tem todo o direito de entrar.
//
// **O nome só vem na primeira autorização**, e vem do aparelho, não do token:
// por isso ele chega no corpo da requisição, e só é aceito para gravar o que
// ainda não existe. Mandar o nome no corpo não é uma brecha — ele não
// identifica ninguém, e a identidade continua saindo do token assinado.
async function identidadeDaApple(
  identityToken: string,
  nomeDoAparelho: unknown,
): Promise<QuemEntrou | null> {
  const identidade = await verificarIdentityTokenDaApple(identityToken)
  if (!identidade) return null

  // Contas separadas por provedor, com id prefixado (decisão 15.2).
  const id = idDaContaApple(identidade.sub)
  const existente = await buscarUsuarioPorId(id)
  const email = identidade.email ?? existente?.email
  if (!email) return null

  const nome = typeof nomeDoAparelho === 'string' && nomeDoAparelho.trim() ? nomeDoAparelho.trim() : null
  return { id, email, nome: existente?.nome ? undefined : nome }
}
