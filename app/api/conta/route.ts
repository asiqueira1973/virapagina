// DELETE /api/conta — apaga a conta e tudo que é dela (spec-ios seções 12 e 13).
//
// Existe por exigência da App Review — aplicativo que cria conta precisa
// permitir apagá-la de dentro do app —, e por coerência com a página de
// privacidade, que já promete que excluir apaga o arquivo de verdade.
//
// A ordem é a da regra 11.6, aplicada livro a livro: **documento primeiro,
// arquivos depois**. Ao contrário, uma falha no meio deixaria metadado apontando
// para arquivo que não existe mais — e o inverso, que é o que esta ordem
// produz, deixa no máximo arquivo órfão, que o log registra e uma varredura
// recolhe.
//
// Não há confirmação por e-mail nem período de arrependimento: a confirmação é
// a do app, que faz a pessoa escrever o próprio endereço antes de liberar o
// botão.
import { NextResponse } from 'next/server'
import { excluirLivro, excluirUsuario, listarLivrosDoDono } from '@/lib/firebase/firestore'
import { apagarPasta, apagarPastaDoLivro, pastaDoLivroPeloPdf } from '@/lib/firebase/storage'
import { requireAutor } from '@/lib/guards'

export async function DELETE() {
  // `exigeHandle: false`: quem desistiu antes de escolher o endereço também
  // pode apagar a conta — e é exatamente quem mais tende a querer.
  const guarda = await requireAutor({ exigeHandle: false })
  if (!guarda.autorizado) return guarda.resposta

  const usuarioId = guarda.usuario.id

  try {
    const livros = await listarLivrosDoDono(usuarioId)

    for (const livro of livros) {
      await excluirLivro(livro.id)
      // Duas pastas, como na exclusão avulsa: nos livros criados antes de
      // 12/09/2026 o id do documento e o da pasta divergem, e apagar só a
      // derivada do id deixaria o PDF no bucket depois de a conta ter sido
      // apagada (pegadinha 10 do CLAUDE.md).
      await apagarPasta(`${pastaDoLivroPeloPdf(livro.arquivo_pdf_caminho)}/`)
      await apagarPastaDoLivro(usuarioId, livro.id)
    }

    // O handle volta a ficar livre: segurar o endereço de quem pediu para sumir
    // seria guardar um dado que a pessoa mandou apagar.
    await excluirUsuario(usuarioId)

    return NextResponse.json({ excluida: true })
  } catch (erro) {
    console.error(`Falha ao excluir a conta ${usuarioId}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
