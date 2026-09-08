// GET /api/livros/[slug]/capa — proxy da imagem de capa guardada no Drive
// (spec seção 13). Mesma regra de visibilidade do PDF: rascunho só aparece para
// admin logado. Devolve 404 quando o livro ainda não tem capa gerada (regra 11.1).
import { NextResponse } from 'next/server'
import { livroVisivelPara } from '@/lib/books'
import { isAdminRequest } from '@/lib/google/auth'
import { downloadFileStream } from '@/lib/google/drive'
import { findBookBySlug } from '@/lib/google/sheets'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  try {
    const ehAdmin = await isAdminRequest()
    const livro = await findBookBySlug(slug, !ehAdmin)

    if (!livro || !livroVisivelPara(livro, ehAdmin) || !livro.capa_drive_id) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    const stream = await downloadFileStream(livro.capa_drive_id)
    return new Response(stream, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control':
          livro.publicado === 'sim'
            ? 'public, max-age=3600, stale-while-revalidate=86400'
            : 'private, no-store',
      },
    })
  } catch (erro) {
    console.error(`Falha ao transmitir a capa do livro ${slug}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
