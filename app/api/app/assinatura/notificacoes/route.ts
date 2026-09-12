// POST /api/app/assinatura/notificacoes — as App Store Server Notifications V2
// (spec-ios seção 5, critério D.4).
//
// É o servidor da Apple que avisa renovação, falha de cobrança, cancelamento e
// reembolso. Sem esta rota, uma conta só seria rebaixada quando a pessoa abrisse
// o app — isto é, nunca, porque quem cancelou não abre.
//
// **Esta rota não tem guarda de sessão, e é correto que não tenha.** Quem chama é
// a Apple, que não tem conta aqui. A autenticação é a assinatura do JWS: a
// cadeia de certificados até a Apple Root CA - G3 é o que separa uma notificação
// de verdade de um POST de qualquer um. É por isso que a verificação vem antes
// de qualquer leitura no Firestore.
import { NextResponse } from 'next/server'
import {
  assinaturaDeTransacao,
  verificarJwsDaApple,
  type NotificacaoDaApple,
  type RenovacaoDaApple,
  type TransacaoDaApple,
} from '@/lib/appstore'
import { buscarUsuarioPorTransacaoOriginal, definirAssinatura } from '@/lib/firebase/firestore'

export async function POST(request: Request) {
  try {
    const corpo = await request.json()
    const payload = typeof corpo?.signedPayload === 'string' ? corpo.signedPayload : ''
    if (!payload) return NextResponse.json({ erro: 'Notificação inválida.' }, { status: 400 })

    const notificacao = verificarJwsDaApple<NotificacaoDaApple>(payload)
    if (!notificacao) return NextResponse.json({ erro: 'Notificação inválida.' }, { status: 400 })

    // A notificação embrulha outros dois JWS, cada um com a própria assinatura.
    // Verificar só o de fora deixaria o conteúdo que decide o plano sem conferência.
    const transacaoJws = notificacao.data?.signedTransactionInfo
    const transacao = transacaoJws ? verificarJwsDaApple<TransacaoDaApple>(transacaoJws) : null
    if (!transacao) return NextResponse.json({ erro: 'Notificação inválida.' }, { status: 400 })

    const renovacaoJws = notificacao.data?.signedRenewalInfo
    const renovacao = renovacaoJws ? verificarJwsDaApple<RenovacaoDaApple>(renovacaoJws) : null

    const assinatura = assinaturaDeTransacao(transacao, renovacao)
    // JWS legítimo de outro produto ou de outro app: nada a fazer, e repetir não
    // muda isso. 200 encerra as tentativas da Apple.
    if (!assinatura) return NextResponse.json({ recebido: true })

    const usuario = await buscarUsuarioPorTransacaoOriginal(assinatura.transacao_original_id)
    // Conta não encontrada é o caso de uma compra que nunca chegou a ser
    // confirmada pelo app — a primeira notificação pode chegar antes dele. Não é
    // erro, e repetir não resolve: a confirmação do app grava o vínculo.
    if (!usuario) {
      console.warn(
        `Notificação da Apple sem conta vinculada: ${assinatura.transacao_original_id}`,
      )
      return NextResponse.json({ recebido: true })
    }

    // Rebaixar não tira nada do ar (regra iOS 10.4): `definirAssinatura` mexe no
    // plano da conta e em livro nenhum.
    await definirAssinatura(usuario.id, assinatura)

    return NextResponse.json({ recebido: true })
  } catch (erro) {
    // 500 faz a Apple tentar de novo, que é o que se quer quando a falha é
    // nossa. Só o JWS inválido devolve 400, porque repetir não o conserta.
    console.error('Falha ao processar notificação da Apple:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
