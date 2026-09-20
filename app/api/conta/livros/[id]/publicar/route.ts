// POST /api/conta/livros/[id]/publicar — publica o livro (spec seção 13.2).
// A partir daqui o livro aparece na vitrine e a URL pública responde para
// qualquer visitante (regra 11.4, máquina de estado da seção 12).
import { NextResponse } from 'next/server'
import { toLivroDoAutor } from '@/lib/books'
import { atualizarLivro } from '@/lib/firebase/firestore'
import { requireDonoDoLivro } from '@/lib/guards'
import { registrarEvento } from '@/lib/visao'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guarda = await requireDonoDoLivro(id)
  if (!guarda.autorizado) return guarda.resposta

  try {
    // Livro despublicado por denúncia não volta pela mão do dono (regra 11.12).
    if (guarda.livro.removido_por_denuncia) {
      return NextResponse.json(
        { erro: 'Este livro foi despublicado por violar os termos de uso. Fale com o suporte.' },
        { status: 409 },
      )
    }

    const atualizado = await atualizarLivro(id, { publicado: true })
    if (!atualizado) return NextResponse.json({ erro: 'Livro não encontrado.' }, { status: 404 })

    registrarEvento({
      nome: 'livro_publicado',
      quem: guarda.usuario.email,
      tela: 'EditarLivro',
      descricao: 'publicou o livro, que passa a responder na URL pública',
      propriedades: {
        endereco: `/${guarda.usuario.handle ?? ''}/${atualizado.slug}`,
        total_paginas: atualizado.total_paginas,
      },
    })

    return NextResponse.json({
      livro: toLivroDoAutor(atualizado, guarda.usuario.handle ?? ''),
    })
  } catch (erro) {
    console.error(`Falha ao publicar o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
