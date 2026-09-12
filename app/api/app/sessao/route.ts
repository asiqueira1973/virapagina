// POST /api/app/sessao — troca o `id_token` do Google pelo token do app
// (spec-ios seção 3, critério A.1).
//
// É a única rota do produto que autentica alguém a partir do zero: ela roda
// **sem** guarda, porque é ela que cria a sessão. O que faz o papel da guarda é a
// verificação do id_token — assinatura, emissor, público e prazo — em
// `lib/app-auth.ts`.
//
// Depois daqui, toda rota que o app chama passa por `requireAutor()` como
// qualquer requisição do navegador.
import { NextResponse } from 'next/server'
import { assinarTokenDoApp, verificarIdTokenDoGoogle } from '@/lib/app-auth'
import { contaParaOApp } from '@/lib/app-conta'
import { garantirUsuario } from '@/lib/firebase/firestore'

export async function POST(request: Request) {
  try {
    const corpo = await request.json()
    const idToken = typeof corpo?.id_token === 'string' ? corpo.id_token : ''
    if (!idToken) {
      return NextResponse.json({ erro: 'Não foi possível entrar. Tente novamente.' }, { status: 401 })
    }

    const identidade = await verificarIdTokenDoGoogle(idToken)
    if (!identidade) {
      return NextResponse.json({ erro: 'Não foi possível entrar. Tente novamente.' }, { status: 401 })
    }

    // `origem: 'app'` só tem efeito quando a conta está nascendo (regra iOS
    // 10.1): conta criada aqui nasce gratuita, com 5 livros, mesmo com a chave
    // de early adopter ligada. Quem já existe entra com o plano que tem —
    // inclusive ilimitado, sem paywall (regra iOS 10.2).
    const usuario = await garantirUsuario({
      id: identidade.sub,
      email: identidade.email,
      nome: identidade.nome,
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
