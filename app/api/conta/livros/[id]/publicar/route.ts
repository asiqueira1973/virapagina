// POST /api/conta/livros/[id]/publicar — publica o livro (spec seção 13.2).
// A partir daqui o livro aparece na vitrine e a URL pública responde para
// qualquer visitante (regra 11.4, máquina de estado da seção 12).
import { NextResponse } from 'next/server'
import { atualizarLivro } from '@/lib/firebase/firestore'
import { requireDonoDoLivro } from '@/lib/guards'

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
    return NextResponse.json({ livro: atualizado })
  } catch (erro) {
    console.error(`Falha ao publicar o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
