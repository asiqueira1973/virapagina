// POST /api/admin/livros — cria um livro novo, sempre como rascunho
// (spec seção 13, épico 8.2, fluxo da seção 9).
//
// Quando esta rota é chamada, o PDF já subiu para o Drive pela sessão resumável:
// o corpo traz o id do arquivo, não os bytes. Nenhuma linha é escrita na planilha
// antes de o upload terminar com sucesso (fluxo de exceção da seção 9).
import { randomUUID } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/google/auth'
import { deleteFile, uploadCapaPng } from '@/lib/google/drive'
import { TAG_CACHE_LIVROS, insertBook, slugEmUso, sugerirSlugDisponivel } from '@/lib/google/sheets'
import { slugValido, slugify } from '@/lib/slug'
import type { Livro } from '@/types/livro'

export async function POST(request: Request) {
  // Primeira linha, sem exceção (seção 6): nada é lido nem escrito no Google antes.
  const guarda = await requireAdmin()
  if (!guarda.autorizado) return guarda.resposta

  try {
    const corpo = await request.json()

    const titulo = String(corpo?.titulo ?? '').trim()
    if (!titulo) {
      return NextResponse.json({ erro: 'Informe o título do livro.' }, { status: 400 })
    }

    const arquivoPdfDriveId = String(corpo?.arquivo_pdf_drive_id ?? '').trim()
    if (!arquivoPdfDriveId) {
      return NextResponse.json({ erro: 'Envie um arquivo PDF.' }, { status: 400 })
    }

    // Slug em branco vira o kebab-case do título (regra 11.3).
    const slug = slugify(String(corpo?.slug ?? '').trim() || titulo)
    if (!slugValido(slug)) {
      return NextResponse.json(
        { erro: 'O link só pode ter letras minúsculas, números e hífen.', campo: 'slug' },
        { status: 400 },
      )
    }

    // A planilha não impõe unicidade — esta é a única checagem que existe
    // (seção 7 e critério 8.2). O 409 devolve a sugestão que a tela mostra.
    if (await slugEmUso(slug)) {
      return NextResponse.json(
        {
          erro: 'Esse link já está em uso, escolha outro.',
          campo: 'slug',
          sugestao: await sugerirSlugDisponivel(slug),
        },
        { status: 409 },
      )
    }

    const capaDriveId = await uploadCapaPng(slug, corpo?.capa_base64)

    const agora = new Date().toISOString()
    const livro: Livro = {
      id: randomUUID(),
      titulo,
      subtitulo: String(corpo?.subtitulo ?? '').trim() || null,
      slug,
      autor: String(corpo?.autor ?? '').trim() || 'Alexandre Siqueira',
      descricao: String(corpo?.descricao ?? '').trim() || null,
      arquivo_pdf_drive_id: arquivoPdfDriveId,
      arquivo_pdf_tamanho_bytes: Number.isFinite(Number(corpo?.arquivo_pdf_tamanho_bytes))
        ? Number(corpo.arquivo_pdf_tamanho_bytes)
        : null,
      capa_drive_id: capaDriveId,
      total_paginas: Number.isFinite(Number(corpo?.total_paginas))
        ? Number(corpo.total_paginas)
        : null,
      // Todo livro nasce rascunho e só o admin publica (máquina de estado da seção 12).
      publicado: 'nao',
      criado_por: guarda.email,
      criado_em: agora,
      atualizado_em: agora,
    }

    try {
      await insertBook(livro)
    } catch (erro) {
      // Se a planilha recusar a linha, a capa recém-criada viraria arquivo órfão.
      if (capaDriveId) await deleteFile(capaDriveId)
      throw erro
    }

    // Ação de admin invalida o cache das telas públicas na hora (regra 11.7).
    revalidateTag(TAG_CACHE_LIVROS)

    return NextResponse.json({ livro }, { status: 201 })
  } catch (erro) {
    console.error('Falha ao criar livro:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
