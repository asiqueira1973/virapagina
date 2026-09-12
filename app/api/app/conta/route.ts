// GET /api/app/conta — o estado da conta para o app (spec-ios critério A.4).
//
// É a primeira chamada de toda abertura do app: é ela que diz se há handle (e
// portanto se a tela de escolha aparece), qual é o plano, quantos livros já
// existem contra o limite e como está a assinatura.
//
// Roda com `exigeHandle: false` de propósito. As outras rotas devolvem 409 para
// conta sem handle, e esta precisa responder justamente nesse estado — senão o
// app não teria como saber que precisa mandar a pessoa escolher o endereço.
import { NextResponse } from 'next/server'
import { contaParaOApp } from '@/lib/app-conta'
import { requireAutor } from '@/lib/guards'

export async function GET() {
  const guarda = await requireAutor({ exigeHandle: false })
  if (!guarda.autorizado) return guarda.resposta

  try {
    return NextResponse.json({ conta: await contaParaOApp(guarda.usuario) })
  } catch (erro) {
    console.error('Falha ao ler a conta:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
