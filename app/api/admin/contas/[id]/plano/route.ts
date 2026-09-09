// POST /api/admin/contas/[id]/plano — altera a faixa de uma conta
// (spec seção 13.3, épico 8.7).
//
// É assim que alguém que pediu mais livros é atendido no v3, enquanto não existe
// cobrança. **Não toca em livro nenhum**: mudar de plano nunca tira nada do ar,
// nem quando a conta fica acima do novo limite (regra 11.9).
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admins'
import { alterarPlano, buscarUsuarioPorId, registrarAcaoAdmin } from '@/lib/firebase/firestore'
import { requireAdminPlataforma } from '@/lib/guards'
import { PLANOS_CONCEDIVEIS, planoValido } from '@/lib/planos'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guarda = await requireAdminPlataforma()
  if (!guarda.autorizado) return guarda.resposta

  const { id } = await params
  try {
    const conta = await buscarUsuarioPorId(id)
    if (!conta) return NextResponse.json({ erro: 'Conta não encontrada.' }, { status: 404 })

    // Conta do dono é ilimitada por definição, e o próximo login desfaria a
    // mudança de qualquer jeito (regra 11.13).
    if (isAdminEmail(conta.email)) {
      return NextResponse.json(
        { erro: 'Contas da plataforma são ilimitadas e não têm plano alterável.' },
        { status: 409 },
      )
    }

    const corpo = await request.json()
    if (!planoValido(corpo?.plano)) {
      return NextResponse.json({ erro: 'Plano desconhecido.' }, { status: 400 })
    }
    // `ilimitado` não se concede: ele é automático para os e-mails da plataforma
    // (regra 11.13) e dá conta sem franquia de tráfego. Dá-lo a um terceiro
    // tiraria o único alarme que existe contra a fatura do Blaze.
    if (!PLANOS_CONCEDIVEIS.includes(corpo.plano)) {
      return NextResponse.json(
        { erro: 'Esse plano não pode ser concedido pela tela.' },
        { status: 409 },
      )
    }

    await alterarPlano(id, corpo.plano)
    await registrarAcaoAdmin({
      admin_email: guarda.email,
      acao: 'alterou_plano',
      conta_alvo: id,
      detalhe: { antes: conta.plano, depois: corpo.plano },
    })

    return NextResponse.json({ plano: corpo.plano })
  } catch (erro) {
    console.error(`Falha ao alterar o plano da conta ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
