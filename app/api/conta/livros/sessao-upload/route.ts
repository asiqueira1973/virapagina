// POST /api/conta/livros/sessao-upload — abre uma sessão de upload no Storage e
// devolve a URL temporária dela para o navegador enviar o PDF (spec seção 13.2).
//
// Os bytes não passam por aqui de propósito: funções serverless da Vercel aceitam
// ~4,5 MB de corpo, o que tornaria a regra 11.2 (PDF de até 100 MB) impossível.
// A credencial da conta de serviço continua sem sair do servidor.
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { contarLivrosDoDono } from '@/lib/firebase/firestore'
import { caminhoDoPdf, criarSessaoDeUpload } from '@/lib/firebase/storage'
import { requireAutor, requireDonoDoLivro } from '@/lib/guards'
import { limiteDeLivros, temVagaParaNovoLivro } from '@/lib/planos'

// Teto da regra 11.2, repetido aqui no servidor: a checagem do navegador é a que
// dá a mensagem ao autor, mas não pode ser a única.
const TAMANHO_MAXIMO_BYTES = 100 * 1024 * 1024

export async function POST(request: Request) {
  // Primeira linha, sem exceção: nada acontece no Storage antes disso (seção 6).
  const guarda = await requireAutor()
  if (!guarda.autorizado) return guarda.resposta

  try {
    const corpo = await request.json()
    const mimeType = typeof corpo?.mimeType === 'string' ? corpo.mimeType : ''
    const tamanhoBytes = Number(corpo?.tamanhoBytes)
    // Presente só na substituição: é o livro que já existe.
    const livroExistente =
      typeof corpo?.livro_id === 'string' && corpo.livro_id ? corpo.livro_id : null

    if (mimeType !== 'application/pdf') {
      return NextResponse.json({ erro: 'Envie um arquivo PDF.' }, { status: 400 })
    }
    if (!Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0) {
      return NextResponse.json({ erro: 'Envie um arquivo PDF.' }, { status: 400 })
    }
    if (tamanhoBytes > TAMANHO_MAXIMO_BYTES) {
      return NextResponse.json(
        { erro: 'Arquivo muito grande (máximo 100 MB).' },
        { status: 400 },
      )
    }

    // Substituição: o destino é o caminho que o próprio livro registra, e não um
    // derivado do id (critério 8.2).
    //
    // Os dois coincidem nos livros criados a partir de agora, e **não coincidem**
    // nos criados antes — nesses, o id do documento e o da pasta são diferentes.
    // Escrever no caminho derivado do id deixava o arquivo novo numa pasta que o
    // leitor nunca abre: o autor trocava o PDF e continuava vendo o antigo.
    //
    // `requireDonoDoLivro` é o que torna isso seguro: sem ele, o corpo da
    // requisição escolheria em que caminho escrever (invariante da seção 6).
    let caminho: string
    let livroId: string

    if (livroExistente) {
      const dono = await requireDonoDoLivro(livroExistente)
      if (!dono.autorizado) return dono.resposta
      caminho = dono.livro.arquivo_pdf_caminho
      livroId = livroExistente
    } else {
      // O limite do plano é checado aqui também, e não só na criação: sem isso,
      // uma conta cheia ainda conseguiria encher o Storage (regra 11.8).
      const quantidade = await contarLivrosDoDono(guarda.usuario.id)
      if (!temVagaParaNovoLivro(guarda.usuario.plano, quantidade)) {
        return NextResponse.json(
          { erro: `Você chegou ao limite de ${limiteDeLivros(guarda.usuario.plano)} livros.` },
          { status: 409 },
        )
      }
      // Livro novo ganha um id agora, antes mesmo de existir documento — assim o
      // arquivo já nasce no lugar definitivo, e o documento herda o mesmo id.
      livroId = randomUUID()
      caminho = caminhoDoPdf(guarda.usuario.id, livroId)
    }
    // A origem precisa ir na abertura da sessão para o Google devolver uma URL
    // que o navegador consegue usar (CORS).
    const uploadUrl = await criarSessaoDeUpload({
      caminho,
      mimeType,
      origin: new URL(request.url).origin,
    })

    return NextResponse.json({ uploadUrl, caminho, livro_id: livroId })
  } catch (erro) {
    console.error('Falha ao abrir sessão de upload:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
