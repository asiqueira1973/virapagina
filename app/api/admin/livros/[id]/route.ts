// PUT /api/admin/livros/[id] — atualiza os metadados de um livro.
// DELETE /api/admin/livros/[id] — exclui o livro em definitivo (regra 11.6).
// Spec seção 13, épico 8.2.
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/google/auth'
import { deleteFile } from '@/lib/google/drive'
import {
  TAG_CACHE_LIVROS,
  deleteBookRow,
  findBookById,
  slugEmUso,
  sugerirSlugDisponivel,
  updateBook,
} from '@/lib/google/sheets'
import { slugValido, slugify } from '@/lib/slug'

// Atualiza título, subtítulo, slug, autor e descrição. O PDF não é tocado aqui —
// trocar de arquivo é a ação separada "Substituir PDF" (critério 8.2).
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guarda = await requireAdmin()
  if (!guarda.autorizado) return guarda.resposta

  const { id } = await params
  try {
    const existente = await findBookById(id)
    if (!existente) {
      return NextResponse.json({ erro: 'Livro não encontrado.' }, { status: 404 })
    }

    const corpo = await request.json()

    const titulo = String(corpo?.titulo ?? '').trim()
    if (!titulo) {
      return NextResponse.json({ erro: 'Informe o título do livro.' }, { status: 400 })
    }

    const slug = slugify(String(corpo?.slug ?? '').trim() || titulo)
    if (!slugValido(slug)) {
      return NextResponse.json(
        { erro: 'O link só pode ter letras minúsculas, números e hífen.', campo: 'slug' },
        { status: 400 },
      )
    }

    // Revalida a unicidade sempre que o slug mudou, ignorando o próprio livro.
    if (slug !== existente.slug && (await slugEmUso(slug, id))) {
      return NextResponse.json(
        {
          erro: 'Esse link já está em uso, escolha outro.',
          campo: 'slug',
          sugestao: await sugerirSlugDisponivel(slug, id),
        },
        { status: 409 },
      )
    }

    // `atualizado_em` é reescrito dentro de updateBook — não há trigger de banco
    // fazendo isso por nós (seção 7).
    const atualizado = await updateBook(id, {
      titulo,
      subtitulo: String(corpo?.subtitulo ?? '').trim() || null,
      slug,
      autor: String(corpo?.autor ?? '').trim() || 'Alexandre Siqueira',
      descricao: String(corpo?.descricao ?? '').trim() || null,
    })

    revalidateTag(TAG_CACHE_LIVROS)
    return NextResponse.json({ livro: atualizado })
  } catch (erro) {
    console.error(`Falha ao atualizar o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}

// Exclusão definitiva, sem lixeira (assunção 24.7). A ordem da regra 11.6 é
// obrigatória: primeiro a linha da planilha, só depois os arquivos do Drive —
// assim nunca sobra metadado apontando para arquivo que não existe mais.
export async function DELETE(
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

    const removido = await deleteBookRow(id)
    if (!removido) {
      return NextResponse.json({ erro: 'Livro não encontrado.' }, { status: 404 })
    }

    // Só agora os arquivos. deleteFile não lança: falha aqui vira log de arquivo
    // órfão, e não uma exclusão pela metade.
    if (livro.arquivo_pdf_drive_id) await deleteFile(livro.arquivo_pdf_drive_id)
    if (livro.capa_drive_id) await deleteFile(livro.capa_drive_id)

    revalidateTag(TAG_CACHE_LIVROS)
    return NextResponse.json({ excluido: true })
  } catch (erro) {
    console.error(`Falha ao excluir o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
