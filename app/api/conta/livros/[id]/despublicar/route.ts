// POST /api/conta/livros/[id]/despublicar — tira o livro do ar sem apagar nada
// (spec seção 13.2, critério 8.2). O livro some da vitrine e a URL pública passa
// a devolver 404 para visitante; o dono continua vendo pela prévia (regra 11.4).
import { NextResponse } from 'next/server'
import { atualizarLivro } from '@/lib/firebase/firestore'
import { requireDonoDoLivro } from '@/lib/guards'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guarda = await requireDonoDoLivro(id)
  if (!guarda.autorizado) return guarda.resposta

  try {
    const atualizado = await atualizarLivro(id, { publicado: false })
    return NextResponse.json({ livro: atualizado })
  } catch (erro) {
    console.error(`Falha ao despublicar o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
