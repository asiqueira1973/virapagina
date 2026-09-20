// POST /api/conta/livros/[id]/despublicar — tira o livro do ar sem apagar nada
// (spec seção 13.2, critério 8.2). O livro some da vitrine e a URL pública passa
// a devolver 404 para visitante; o dono continua vendo pela prévia (regra 11.4).
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
    const atualizado = await atualizarLivro(id, { publicado: false })
    if (!atualizado) return NextResponse.json({ erro: 'Livro não encontrado.' }, { status: 404 })

    registrarEvento({
      nome: 'livro_despublicado',
      quem: guarda.usuario.email,
      tela: 'EditarLivro',
      descricao: 'tirou o livro do ar sem apagar o arquivo',
      propriedades: { endereco: `/${guarda.usuario.handle ?? ''}/${atualizado.slug}` },
    })

    return NextResponse.json({
      livro: toLivroDoAutor(atualizado, guarda.usuario.handle ?? ''),
    })
  } catch (erro) {
    console.error(`Falha ao despublicar o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
