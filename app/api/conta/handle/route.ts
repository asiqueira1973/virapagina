// Rotas do endereço público da conta (spec seção 13.2, épico 8.1).
//
// GET  — diz se um handle está livre e sugere uma alternativa quando não está.
// POST — reserva o handle e o grava na conta, numa transação.
//
// Estas são as duas únicas rotas que rodam com `exigeHandle: false`: elas
// acontecem justamente antes de a conta ter handle.
import { NextResponse } from 'next/server'
import { FORMATO_DE_HANDLE, handleDisponivel, reservarHandle, sugerirHandleLivre } from '@/lib/firebase/firestore'
import { requireAutor } from '@/lib/guards'
import { registrarEvento } from '@/lib/visao'

export async function GET(request: Request) {
  const guarda = await requireAutor({ exigeHandle: false })
  if (!guarda.autorizado) return guarda.resposta

  try {
    const pedido = (new URL(request.url).searchParams.get('handle') ?? '').trim().toLowerCase()
    if (!FORMATO_DE_HANDLE.test(pedido)) {
      return NextResponse.json({ valido: false, disponivel: false, sugestao: null })
    }
    const livre = await handleDisponivel(pedido)
    return NextResponse.json({
      valido: true,
      disponivel: livre,
      sugestao: livre ? null : await sugerirHandleLivre(pedido),
    })
  } catch (erro) {
    console.error('Falha ao checar disponibilidade de handle:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  // Primeira linha, sem exceção (seção 6).
  const guarda = await requireAutor({ exigeHandle: false })
  if (!guarda.autorizado) return guarda.resposta

  try {
    // O handle é escolhido uma vez só (regra 11.10). Trocar é ação de admin.
    if (guarda.usuario.handle) {
      return NextResponse.json(
        { erro: 'Seu endereço já está definido. Para trocar, fale com o suporte.' },
        { status: 409 },
      )
    }

    const corpo = await request.json()
    const pedido = String(corpo?.handle ?? '').trim().toLowerCase()

    if (!FORMATO_DE_HANDLE.test(pedido)) {
      return NextResponse.json(
        { erro: 'Use de 3 a 30 letras minúsculas, números ou hífen.', campo: 'handle' },
        { status: 400 },
      )
    }

    // A transação é o que impede dois cadastros simultâneos de vencerem os dois.
    const reservado = await reservarHandle(guarda.usuario.id, pedido)
    if (!reservado) {
      return NextResponse.json(
        {
          erro: 'Esse endereço já está em uso, escolha outro.',
          campo: 'handle',
          sugestao: await sugerirHandleLivre(pedido),
        },
        { status: 409 },
      )
    }

    registrarEvento({
      nome: 'handle_escolhido',
      quem: guarda.usuario.email,
      tela: 'EscolherEndereco',
      descricao: 'escolheu o endereço público da conta',
      propriedades: { handle: pedido },
    })

    return NextResponse.json({ handle: pedido }, { status: 201 })
  } catch (erro) {
    console.error('Falha ao definir handle:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
