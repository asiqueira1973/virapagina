// GET  /api/conta/livros — lista os livros da conta (spec-ios critério A.4).
// POST /api/conta/livros — cria um livro, sempre como rascunho
// (spec seção 13.2, épico 8.2, fluxo da seção 9).
//
// Quando esta rota é chamada, o PDF já subiu para o Storage pela sessão de
// upload: o corpo traz o caminho, não os bytes. Nenhum documento é escrito antes
// de o upload terminar com sucesso (fluxo de exceção da seção 9).
import { NextResponse } from 'next/server'
import { toLivroDoAutor } from '@/lib/books'
import { contarLivrosDoDono, criarLivro, listarLivrosDoDono, slugEmUsoNaConta, sugerirSlugLivreNaConta } from '@/lib/firebase/firestore'
import { apagarPastaDoLivro, caminhoDaCapa, caminhoDoPdf, enviarCapaPng } from '@/lib/firebase/storage'
import { requireAutor } from '@/lib/guards'
import { limiteDeLivros, temVagaParaNovoLivro } from '@/lib/planos'
import { slugValido, slugify } from '@/lib/slug'
import { registrarEvento } from '@/lib/visao'

// A lista que o painel da web monta em componente de servidor, agora também como
// rota — o app não renderiza React no servidor, e precisa dos mesmos dados.
//
// Vem junto o uso contra o limite porque a tela mostra "3 de 5 livros" no
// cabeçalho: pedir isso em duas requisições faria o número piscar depois da lista.
export async function GET() {
  const guarda = await requireAutor()
  if (!guarda.autorizado) return guarda.resposta

  try {
    const livros = await listarLivrosDoDono(guarda.usuario.id)
    const handle = guarda.usuario.handle ?? ''
    return NextResponse.json({
      livros: livros.map((livro) => toLivroDoAutor(livro, handle)),
      uso: { livros: livros.length, limite: limiteDeLivros(guarda.usuario.plano) },
    })
  } catch (erro) {
    console.error('Falha ao listar livros da conta:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}

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

    registrarEvento({
      nome: 'livro_criado',
      quem: guarda.usuario.email,
      tela: 'NovoLivro',
      descricao: 'subiu um PDF e criou o livro como rascunho',
      propriedades: {
        total_paginas: livro.total_paginas,
        tamanho_bytes: livro.arquivo_pdf_tamanho_bytes,
        livros_na_conta: quantidade + 1,
      },
    })

    // `toLivroDoAutor` e não o documento cru: é ele que acrescenta as URLs com
    // `?v=` e o aviso de denúncia. Toda rota que devolve um livro para quem é
    // dono passa por aqui — o app decodifica esse formato, e um documento cru
    // faz a decodificação falhar com "Algo deu errado", sem dizer o porquê.
    return NextResponse.json(
      { livro: toLivroDoAutor(livro, guarda.usuario.handle ?? '') },
      { status: 201 },
    )
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
