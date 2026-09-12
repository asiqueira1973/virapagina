// POST /api/conta/livros — cria um livro, sempre como rascunho
// (spec seção 13.2, épico 8.2, fluxo da seção 9).
//
// Quando esta rota é chamada, o PDF já subiu para o Storage pela sessão de
// upload: o corpo traz o caminho, não os bytes. Nenhum documento é escrito antes
// de o upload terminar com sucesso (fluxo de exceção da seção 9).
import { NextResponse } from 'next/server'
import { contarLivrosDoDono, criarLivro, slugEmUsoNaConta, sugerirSlugLivreNaConta } from '@/lib/firebase/firestore'
import { apagarPastaDoLivro, caminhoDaCapa, caminhoDoPdf, enviarCapaPng } from '@/lib/firebase/storage'
import { requireAutor } from '@/lib/guards'
import { limiteDeLivros, temVagaParaNovoLivro } from '@/lib/planos'
import { slugValido, slugify } from '@/lib/slug'

export async function POST(request: Request) {
  const guarda = await requireAutor()
  if (!guarda.autorizado) return guarda.resposta

  const donoId = guarda.usuario.id
  // Guardado fora do try: se a criação falhar depois de o PDF já ter subido, é
  // por este id que a limpeza encontra a pasta a apagar.
  let livroIdParaLimpeza: string | null = null

  try {
    const corpo = await request.json()

    const titulo = String(corpo?.titulo ?? '').trim()
    if (!titulo) {
      return NextResponse.json({ erro: 'Informe o título do livro.' }, { status: 400 })
    }

    const livroId = String(corpo?.livro_id ?? '').trim()
    if (!livroId) {
      return NextResponse.json({ erro: 'Envie um arquivo PDF.' }, { status: 400 })
    }
    livroIdParaLimpeza = livroId

    // Limite do plano (regra 11.8). Conta todos os livros, rascunho e publicado.
    const quantidade = await contarLivrosDoDono(donoId)
    if (!temVagaParaNovoLivro(guarda.usuario.plano, quantidade)) {
      return NextResponse.json(
        { erro: `Você chegou ao limite de ${limiteDeLivros(guarda.usuario.plano)} livros.` },
        { status: 409 },
      )
    }

    // Slug em branco vira o kebab-case do título (regra 11.3).
    const slug = slugify(String(corpo?.slug ?? '').trim() || titulo)
    if (!slugValido(slug)) {
      return NextResponse.json(
        { erro: 'O link só pode ter letras minúsculas, números e hífen.', campo: 'slug' },
        { status: 400 },
      )
    }

    // Unicidade é por dono, não global: slug igual ao de outra conta é aceito
    // sem reclamação (critério 8.2).
    if (await slugEmUsoNaConta(donoId, slug)) {
      return NextResponse.json(
        {
          erro: 'Esse link já está em uso, escolha outro.',
          campo: 'slug',
          sugestao: await sugerirSlugLivreNaConta(donoId, slug),
        },
        { status: 409 },
      )
    }

    const caminhoCapa = caminhoDaCapa(donoId, livroId)
    const temCapa = await enviarCapaPng(caminhoCapa, corpo?.capa_base64)

    // O id do documento é o mesmo da pasta no Storage — é isso que faz
    // `arquivo_pdf_caminho` continuar encontrável a partir do livro.
    const livro = await criarLivro(livroId, {
      dono_id: donoId,
      titulo,
      subtitulo: String(corpo?.subtitulo ?? '').trim() || null,
      slug,
      autor: String(corpo?.autor ?? '').trim() || guarda.usuario.nome || guarda.usuario.email,
      descricao: String(corpo?.descricao ?? '').trim() || null,
      arquivo_pdf_caminho: caminhoDoPdf(donoId, livroId),
      arquivo_pdf_tamanho_bytes: Number.isFinite(Number(corpo?.arquivo_pdf_tamanho_bytes))
        ? Number(corpo.arquivo_pdf_tamanho_bytes)
        : null,
      capa_caminho: temCapa ? caminhoCapa : null,
      total_paginas: Number.isFinite(Number(corpo?.total_paginas))
        ? Number(corpo.total_paginas)
        : null,
    })

    return NextResponse.json({ livro }, { status: 201 })
  } catch (erro) {
    console.error('Falha ao criar livro:', erro)
    // O arquivo já enviado viraria lixo no Storage se o documento não nasceu.
    if (livroIdParaLimpeza) await apagarPastaDoLivro(donoId, livroIdParaLimpeza)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
