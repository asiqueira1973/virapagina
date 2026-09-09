// GET /api/livros/[handle]/[slug] — metadados de um livro (spec seção 13.1).
//
// Devolve 404 para handle inexistente, slug inexistente e rascunho de outra
// pessoa — os três dão a mesma resposta de propósito: distingui-los revelaria o
// que existe. É esta checagem, e não uma política de banco, que protege o
// conteúdo não publicado (seções 6 e 20).
import { NextResponse } from 'next/server'
import { resolverLivroPublico, toAutorPublico, toLivroPublico } from '@/lib/books'
import { sessaoAtual } from '@/lib/guards'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string; slug: string }> },
) {
  const { handle, slug } = await params
  try {
    const sessao = await sessaoAtual()
    const resultado = await resolverLivroPublico(handle.toLowerCase(), slug, sessao?.id ?? null)

    if (!resultado) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    return NextResponse.json({
      livro: toLivroPublico(resultado.livro),
      autor: toAutorPublico(resultado.dono),
    })
  } catch (erro) {
    console.error(`Falha ao ler o livro ${handle}/${slug}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
