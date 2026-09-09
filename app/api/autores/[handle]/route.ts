// GET /api/autores/[handle] — dados públicos da vitrine de um autor
// (spec seção 13.1, épico 8.5).
//
// Devolve só os livros publicados daquele dono. Rascunho não sai por aqui nem
// para o próprio dono: a vitrine é a página pública, e conferir rascunho é papel
// da prévia (critério 8.5). Nunca devolve o e-mail do autor.
import { NextResponse } from 'next/server'
import { ordenarPorCriadoEmDesc, toAutorPublico, toLivroPublico } from '@/lib/books'
import { buscarUsuarioPorHandle, listarLivrosDoDono } from '@/lib/firebase/firestore'

export const revalidate = 60

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params
  try {
    const autor = await buscarUsuarioPorHandle(handle.toLowerCase())
    if (!autor) {
      return NextResponse.json({ erro: 'Esse endereço não existe.' }, { status: 404 })
    }

    const publicados = ordenarPorCriadoEmDesc(
      (await listarLivrosDoDono(autor.id)).filter((livro) => livro.publicado),
    )

    return NextResponse.json({
      autor: toAutorPublico(autor),
      livros: publicados.map(toLivroPublico),
    })
  } catch (erro) {
    console.error(`Falha ao ler a vitrine de ${handle}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
