// POST /api/conta/livros/[id]/substituir-pdf — troca o arquivo PDF de um livro
// existente sem mexer nos metadados (spec seção 13.2, critério 8.2).
//
// O novo PDF já foi enviado pela sessão de upload, no mesmo caminho do antigo —
// a pasta é do livro, então substituir é sobrescrever. A capa é regenerada
// junto: ela é, por definição, a primeira página do PDF (regra 11.1), e manter a
// capa antiga sobre um arquivo novo deixaria a vitrine mostrando conteúdo que
// não está mais lá.
import { NextResponse } from 'next/server'
import { atualizarLivro } from '@/lib/firebase/firestore'
import { capaAoLadoDoPdf, enviarCapaPng } from '@/lib/firebase/storage'
import { requireDonoDoLivro } from '@/lib/guards'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guarda = await requireDonoDoLivro(id)
  if (!guarda.autorizado) return guarda.resposta

  try {
    const corpo = await request.json()
    // A capa vai para a pasta do PDF do livro, não para uma derivada do id: nos
    // livros criados antes desta correção os dois ids são diferentes, e a capa
    // acabava sozinha numa pasta à parte, longe do arquivo que ela ilustra.
    const caminhoCapa = capaAoLadoDoPdf(guarda.livro.arquivo_pdf_caminho)
    const temCapa = await enviarCapaPng(caminhoCapa, corpo?.capa_base64)

    // Recalcula tamanho e total de páginas com o que o navegador leu do arquivo
    // novo (critério 8.2).
    const atualizado = await atualizarLivro(id, {
      arquivo_pdf_tamanho_bytes: Number.isFinite(Number(corpo?.arquivo_pdf_tamanho_bytes))
        ? Number(corpo.arquivo_pdf_tamanho_bytes)
        : null,
      total_paginas: Number.isFinite(Number(corpo?.total_paginas))
        ? Number(corpo.total_paginas)
        : null,
      ...(temCapa ? { capa_caminho: caminhoCapa } : {}),
    })

    return NextResponse.json({ livro: atualizado })
  } catch (erro) {
    console.error(`Falha ao substituir o PDF do livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
