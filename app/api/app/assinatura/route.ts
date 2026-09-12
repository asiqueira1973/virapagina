// POST /api/app/assinatura — confirma uma compra feita no app (spec-ios seção 5,
// critério D.2).
//
// O app manda o JWS que a Apple assinou; quem decide o plano é esta rota, depois
// de conferir a cadeia de certificados (regra iOS 10.5). O que o StoreKit devolve
// no aparelho é um pedido, não uma prova: sem esta verificação, livros ilimitados
// custariam um proxy.
import { NextResponse } from 'next/server'
import { contaParaOApp } from '@/lib/app-conta'
import {
  assinaturaDeTransacao,
  verificarJwsDaApple,
  type RenovacaoDaApple,
  type TransacaoDaApple,
} from '@/lib/appstore'
import { buscarUsuarioPorTransacaoOriginal, definirAssinatura } from '@/lib/firebase/firestore'
import { requireAutor } from '@/lib/guards'

export async function POST(request: Request) {
  // Primeira linha, como em toda rota de conta (seção 6). `exigeHandle: false`
  // porque assinar antes de escolher o endereço é um caminho possível.
  const guarda = await requireAutor({ exigeHandle: false })
  if (!guarda.autorizado) return guarda.resposta

  try {
    const corpo = await request.json()
    const transacaoJws = typeof corpo?.transacao_jws === 'string' ? corpo.transacao_jws : ''
    if (!transacaoJws) {
      return NextResponse.json({ erro: 'Não foi possível confirmar a assinatura.' }, { status: 400 })
    }

    const transacao = verificarJwsDaApple<TransacaoDaApple>(transacaoJws)
    if (!transacao) {
      return NextResponse.json({ erro: 'Não foi possível confirmar a assinatura.' }, { status: 400 })
    }

    // A renovação é opcional: ela é que diz se uma assinatura vencida está em
    // nova tentativa de cobrança. Sem ela, vencida é vencida.
    const renovacaoJws = typeof corpo?.renovacao_jws === 'string' ? corpo.renovacao_jws : ''
    const renovacao = renovacaoJws ? verificarJwsDaApple<RenovacaoDaApple>(renovacaoJws) : null

    const assinatura = assinaturaDeTransacao(transacao, renovacao)
    if (!assinatura) {
      return NextResponse.json({ erro: 'Não foi possível confirmar a assinatura.' }, { status: 400 })
    }

    // Uma assinatura vale por uma conta (regra iOS 10.11). Sem esta checagem, um
    // mesmo Apple ID promoveria quantas contas quisesse: bastaria entrar com
    // outro Google no mesmo aparelho e restaurar a compra.
    const jaVinculada = await buscarUsuarioPorTransacaoOriginal(assinatura.transacao_original_id)
    if (jaVinculada && jaVinculada.id !== guarda.usuario.id) {
      return NextResponse.json(
        { erro: 'Esta assinatura já está vinculada a outra conta.' },
        { status: 409 },
      )
    }

    const atualizado = await definirAssinatura(guarda.usuario.id, assinatura)
    if (!atualizado) {
      return NextResponse.json({ erro: 'Não foi possível confirmar a assinatura.' }, { status: 400 })
    }

    return NextResponse.json({
      conta: await contaParaOApp(atualizado),
      assinatura: atualizado.assinatura,
    })
  } catch (erro) {
    console.error('Falha ao confirmar assinatura:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
