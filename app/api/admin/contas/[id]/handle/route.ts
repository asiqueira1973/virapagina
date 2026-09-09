// POST /api/admin/contas/[id]/handle — troca o endereço público de uma conta
// (spec seção 13.3, épico 8.7).
//
// O autor não troca o próprio handle (regra 11.10): handle liberado herda o
// tráfego dos links antigos, o que é sequestro de audiência. Quando a troca
// precisa acontecer — erro de digitação no cadastro, por exemplo —, ela passa por
// aqui, numa transação que libera o antigo e reserva o novo de uma vez.
import { NextResponse } from 'next/server'
import { FORMATO_DE_HANDLE, buscarUsuarioPorId, registrarAcaoAdmin, sugerirHandleLivre, trocarHandle } from '@/lib/firebase/firestore'
import { requireAdminPlataforma } from '@/lib/guards'

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

    const corpo = await request.json()
    const novo = String(corpo?.handle ?? '').trim().toLowerCase()

    if (!FORMATO_DE_HANDLE.test(novo)) {
      return NextResponse.json(
        { erro: 'Use de 3 a 30 letras minúsculas, números ou hífen.' },
        { status: 400 },
      )
    }

    const trocado = await trocarHandle(id, novo)
    if (!trocado) {
      return NextResponse.json(
        { erro: 'Esse endereço já está em uso, escolha outro.', sugestao: await sugerirHandleLivre(novo) },
        { status: 409 },
      )
    }

    await registrarAcaoAdmin({
      admin_email: guarda.email,
      acao: 'alterou_handle',
      conta_alvo: id,
      detalhe: { antes: conta.handle, depois: novo },
    })

    return NextResponse.json({ handle: novo })
  } catch (erro) {
    console.error(`Falha ao trocar o handle da conta ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
