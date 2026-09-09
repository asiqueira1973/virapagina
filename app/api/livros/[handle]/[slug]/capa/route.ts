// GET /api/livros/[handle]/[slug]/capa — proxy da capa guardada no Storage
// (spec seção 13.1). Mesma regra de visibilidade do PDF. Devolve 404 quando o
// livro ainda não tem capa gerada, que é estado previsto (regra 11.1).
import { NextResponse } from 'next/server'
import { resolverLivroPublico } from '@/lib/books'
import { somarTrafego } from '@/lib/firebase/firestore'
import { baixarArquivo } from '@/lib/firebase/storage'
import { sessaoAtual } from '@/lib/guards'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string; slug: string }> },
) {
  const { handle, slug } = await params
  try {
    const sessao = await sessaoAtual()
    const resultado = await resolverLivroPublico(handle.toLowerCase(), slug, sessao?.id ?? null)

    const livro = resultado?.livro
    // Livro sem capa gerada é estado previsto (regra 11.1), e dá o mesmo 404 de
    // livro inexistente — não há nada a mostrar nos dois casos.
    if (!livro?.capa_caminho) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    const arquivo = await baixarArquivo(livro.capa_caminho)
    if (!arquivo) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    void somarTrafego(livro.dono_id, arquivo.tamanhoBytes ?? 0)

    return new Response(arquivo.stream, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': livro.publicado
          ? 'public, max-age=3600, stale-while-revalidate=86400'
          : 'private, no-store',
      },
    })
  } catch (erro) {
    console.error(`Falha ao transmitir a capa de ${handle}/${slug}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
