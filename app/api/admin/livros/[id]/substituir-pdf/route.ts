// POST /api/admin/livros/[id]/substituir-pdf — troca o arquivo PDF de um livro
// existente sem mexer nos metadados (spec seção 13, critério 8.2).
//
// O novo PDF já foi enviado ao Drive pela sessão resumável, então o corpo traz o
// id do arquivo novo. Seguimos o segundo caminho previsto pelo critério 8.2
// ("grava um novo ID e apaga o antigo"), que é o único compatível com upload
// direto do navegador.
//
// A capa é regenerada junto: ela é, por definição, a primeira página do PDF
// (regra 11.1), e manter a capa antiga sobre um arquivo novo deixaria a vitrine
// mostrando conteúdo que não está mais lá.
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/google/auth'
import { deleteFile, uploadCapaPng } from '@/lib/google/drive'
import { TAG_CACHE_LIVROS, findBookById, updateBook } from '@/lib/google/sheets'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guarda = await requireAdmin()
  if (!guarda.autorizado) return guarda.resposta

  const { id } = await params
  try {
    const livro = await findBookById(id)
    if (!livro) {
      return NextResponse.json({ erro: 'Livro não encontrado.' }, { status: 404 })
    }

    const corpo = await request.json()
    const novoPdfDriveId = String(corpo?.arquivo_pdf_drive_id ?? '').trim()
    if (!novoPdfDriveId) {
      return NextResponse.json({ erro: 'Envie um arquivo PDF.' }, { status: 400 })
    }

    const novaCapaDriveId = await uploadCapaPng(livro.slug, corpo?.capa_base64)

    const pdfAntigo = livro.arquivo_pdf_drive_id
    const capaAntiga = livro.capa_drive_id

    // Recalcula tamanho e total de páginas com o que o navegador leu do arquivo
    // novo (critério 8.2).
    const atualizado = await updateBook(id, {
      arquivo_pdf_drive_id: novoPdfDriveId,
      arquivo_pdf_tamanho_bytes: Number.isFinite(Number(corpo?.arquivo_pdf_tamanho_bytes))
        ? Number(corpo.arquivo_pdf_tamanho_bytes)
        : null,
      total_paginas: Number.isFinite(Number(corpo?.total_paginas))
        ? Number(corpo.total_paginas)
        : null,
      ...(novaCapaDriveId ? { capa_drive_id: novaCapaDriveId } : {}),
    })

    // Só apaga os arquivos velhos depois que a planilha já aponta para os novos —
    // mesma ordem de segurança da regra 11.6.
    if (pdfAntigo && pdfAntigo !== novoPdfDriveId) await deleteFile(pdfAntigo)
    if (novaCapaDriveId && capaAntiga && capaAntiga !== novaCapaDriveId) {
      await deleteFile(capaAntiga)
    }

    revalidateTag(TAG_CACHE_LIVROS)
    return NextResponse.json({ livro: atualizado })
  } catch (erro) {
    console.error(`Falha ao substituir o PDF do livro ${id}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
