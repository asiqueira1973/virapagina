// GET /api/livros/[slug] — metadados de um livro pelo slug (spec seção 13, épico 8.3).
// Devolve 404 para slug inexistente e para rascunho pedido por quem não é admin —
// é esta checagem, e não uma política de banco, que protege o conteúdo não
// publicado (seções 6 e 20).
import { NextResponse } from 'next/server'
import { livroVisivelPara, toLivroPublico } from '@/lib/books'
import { isAdminRequest } from '@/lib/google/auth'
import { findBookBySlug } from '@/lib/google/sheets'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  try {
    const ehAdmin = await isAdminRequest()
    // Prévia de rascunho nunca vem do cache: o admin precisa ver o que acabou de
    // salvar (seção 13).
    const livro = await findBookBySlug(slug, !ehAdmin)

    if (!livro || !livroVisivelPara(livro, ehAdmin)) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    return NextResponse.json({ livro: toLivroPublico(livro) })
  } catch (erro) {
    console.error(`Falha ao ler o livro ${slug} na planilha:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
