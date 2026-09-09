// PUT /api/conta/livros/[id] — atualiza os metadados de um livro.
// DELETE /api/conta/livros/[id] — exclui o livro em definitivo (regra 11.6).
// Spec seção 13.2, épico 8.2.
import { NextResponse } from 'next/server'
import { atualizarLivro, excluirLivro, slugEmUsoNaConta, sugerirSlugLivreNaConta } from '@/lib/firebase/firestore'
import { apagarPastaDoLivro } from '@/lib/firebase/storage'
import { requireDonoDoLivro } from '@/lib/guards'
import { slugValido, slugify } from '@/lib/slug'

// Atualiza título, subtítulo, slug, autor e descrição. O PDF não é tocado aqui —
// trocar de arquivo é a ação separada "Substituir PDF" (critério 8.2).
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Primeira linha: livro de outra conta devolve 404, nunca 403 (seção 6).
  const guarda = await requireDonoDoLivro(id)
  if (!guarda.autorizado) return guarda.resposta

  try {
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
    if (slug !== guarda.livro.slug && (await slugEmUsoNaConta(guarda.usuario.id, slug, id))) {
      return NextResponse.json(
        {
          erro: 'Esse link já está em uso, escolha outro.',
          campo: 'slug',
          sugestao: await sugerirSlugLivreNaConta(guarda.usuario.id, slug, id),
        },
        { status: 409 },
      )
    }

    // `atualizado_em` é reescrito dentro de atualizarLivro — não há trigger.
    const atualizado = await atualizarLivro(id, {
      titulo,
      subtitulo: String(corpo?.subtitulo ?? '').trim() || null,
      slug,
      autor: String(corpo?.autor ?? '').trim() || guarda.usuario.nome || guarda.usuario.email,
      descricao: String(corpo?.descricao ?? '').trim() || null,
    })

    return NextResponse.json({ livro: atualizado })
  } catch (erro) {
    console.error(`Falha ao atualizar o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}

// Exclusão definitiva, sem lixeira. A ordem da regra 11.6 é obrigatória:
// primeiro o documento, só depois os arquivos — assim nunca sobra metadado
// apontando para arquivo que não existe mais.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guarda = await requireDonoDoLivro(id)
  if (!guarda.autorizado) return guarda.resposta

  try {
    await excluirLivro(id)
    // apagarPastaDoLivro não lança: falha aqui vira log de arquivo órfão, e não
    // uma exclusão pela metade.
    await apagarPastaDoLivro(guarda.usuario.id, id)
    return NextResponse.json({ excluido: true })
  } catch (erro) {
    console.error(`Falha ao excluir o livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
