// POST /api/admin/livros/[id]/publicar — publica o livro (spec seção 13, épico 8.2).
// A partir daqui o livro aparece no catálogo e a URL pública responde para
// qualquer visitante (regra 11.4, máquina de estado da seção 12).
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

    const atualizado = await updateBook(id, { publicado: 'sim' })
    revalidateTag(TAG_CACHE_LIVROS)
    return NextResponse.json({ livro: atualizado })
  } catch (erro) {
    console.error(`Falha ao publicar o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
