// POST /api/admin/livros/[id]/despublicar — tira o livro do ar sem apagar nada
// (spec seção 13, critério 8.2). O livro some do catálogo e a URL pública passa a
// devolver 404 para visitante; o admin continua vendo pela prévia (regra 11.4).
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/google/auth'
import { TAG_CACHE_LIVROS, findBookById, updateBook } from '@/lib/google/sheets'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guarda = await requireAdmin()
  if (!guarda.autorizado) return guarda.resposta

  const { id } = await params
  try {
    const livro = await findBookById(id)
    if (!livro) {
      return NextResponse.json({ erro: 'Livro não encontrado.' }, { status: 404 })
    }

    const atualizado = await updateBook(id, { publicado: 'nao' })
    revalidateTag(TAG_CACHE_LIVROS)
    return NextResponse.json({ livro: atualizado })
  } catch (erro) {
    console.error(`Falha ao despublicar o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
