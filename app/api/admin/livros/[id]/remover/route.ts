// POST /api/admin/livros/[id]/remover — despublica um livro por denúncia
// (spec seção 13.3, épico 8.7).
//
// Despublica e marca; **não exclui o arquivo**. Remoção indevida precisa ser
// reversível, e o dono do conteúdo não pode perder o trabalho por causa de uma
// denúncia que se mostrou falsa.
//
// Só age sobre livro publicado: é o que a denúncia alcança. Rascunho de terceiro
// não é assunto do admin da plataforma (nota da seção 5).
import { NextResponse } from 'next/server'
import { atualizarLivro, buscarLivroPorId, registrarAcaoAdmin } from '@/lib/firebase/firestore'
import { requireAdminPlataforma } from '@/lib/guards'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guarda = await requireAdminPlataforma()
  if (!guarda.autorizado) return guarda.resposta

  const { id } = await params
  try {
    const livro = await buscarLivroPorId(id)
    if (!livro) return NextResponse.json({ erro: 'Livro não encontrado.' }, { status: 404 })
    if (!livro.publicado) {
      return NextResponse.json(
        { erro: 'Só livro publicado pode ser removido por denúncia.' },
        { status: 409 },
      )
    }

    const corpo = await request.json().catch(() => ({}))
    await atualizarLivro(id, { publicado: false, removido_por_denuncia: true })
    await registrarAcaoAdmin({
      admin_email: guarda.email,
      acao: 'removeu_livro',
      conta_alvo: livro.dono_id,
      livro_alvo: id,
      detalhe: { motivo: String(corpo?.motivo ?? '').trim() || null, titulo: livro.titulo },
    })

    return NextResponse.json({ removido: true })
  } catch (erro) {
    console.error(`Falha ao remover o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
