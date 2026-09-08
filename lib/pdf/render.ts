// Helpers de PDF.js usados no navegador (spec seção 18: /lib/pdf/render.ts).
//
// Tudo aqui roda no cliente, sempre — o servidor nunca converte o PDF em imagem
// (princípio 0.1). No admin isso serve para ler o total de páginas e gerar a capa
// no momento do upload (regra 11.1); no leitor, para desenhar cada página.
import type {
  PDFDocumentProxy,
  RenderParameters,
} from 'pdfjs-dist/types/src/display/api'

// O PDF.js é carregado sob demanda: ele é grande e só faz sentido no navegador.
// A referência é guardada para não recarregar a biblioteca a cada chamada.
let pdfjsCarregado: typeof import('pdfjs-dist') | null = null

async function getPdfjs() {
  if (pdfjsCarregado) return pdfjsCarregado
  const pdfjs = await import('pdfjs-dist')
  // O worker é servido de /public por scripts/copy-pdf-worker.mjs.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  pdfjsCarregado = pdfjs
  return pdfjs
}

// Abre um PDF a partir de um arquivo escolhido no formulário do admin.
export async function abrirPdfDeArquivo(arquivo: File): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs()
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  return pdfjs.getDocument({ data: bytes }).promise
}

// Abre um PDF a partir de uma URL — no leitor público, sempre a rota de proxy
// /api/livros/[slug]/pdf, nunca um link do Drive (seção 4).
export async function abrirPdfDeUrl(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs()
  return pdfjs.getDocument({ url }).promise
}

// Desenha uma página do PDF num canvas na escala pedida. É a função que o leitor
// usa a cada virada e a cada mudança de zoom (regra 11.5).
//
// Devolve a promessa junto de um `cancelar()`, e não só a promessa, porque o
// PDF.js recusa duas renderizações simultâneas no mesmo canvas: sem cancelar a
// anterior, trocar o zoom rápido — ou o efeito rodar duas vezes, como acontece
// em desenvolvimento — deixa a página em branco. Cancelar é obrigatório, não
// otimização.
export function renderizarPagina(
  documento: PDFDocumentProxy,
  numeroDaPagina: number,
  canvas: HTMLCanvasElement,
  escala: number,
): { promessa: Promise<void>; cancelar: () => void } {
  let tarefa: { cancel: () => void } | null = null
  let cancelado = false

  const promessa = (async () => {
    const pagina = await documento.getPage(numeroDaPagina)
    if (cancelado) return
    const viewport = pagina.getViewport({ scale: escala })
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('Canvas sem contexto 2d')

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)

    const emAndamento = pagina.render({ canvasContext: contexto, viewport } as RenderParameters)
    tarefa = emAndamento
    await emAndamento.promise
  })()

  return {
    promessa,
    cancelar() {
      cancelado = true
      tarefa?.cancel()
    },
  }
}

// Gera a capa do livro renderizando a primeira página e devolvendo um PNG em
// base64 (regra 11.1). A largura é limitada porque a capa só é usada como
// miniatura no catálogo e na lista do admin — não precisa da resolução do livro.
export async function gerarCapaPngBase64(
  documento: PDFDocumentProxy,
  larguraMaxima = 800,
): Promise<string | null> {
  try {
    const pagina = await documento.getPage(1)
    const viewportBase = pagina.getViewport({ scale: 1 })
    const escala = Math.min(larguraMaxima / viewportBase.width, 2)
    const viewport = pagina.getViewport({ scale: escala })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const contexto = canvas.getContext('2d')
    if (!contexto) return null

    await pagina.render({ canvasContext: contexto, viewport } as RenderParameters).promise
    return canvas.toDataURL('image/png')
  } catch (erro) {
    // Capa é opcional: `capa_drive_id` nulo é estado previsto na seção 7 e não
    // pode impedir o cadastro do livro.
    console.error('Falha ao gerar a capa a partir da primeira página:', erro)
    return null
  }
}

// Lê o total de páginas do PDF para gravar em `total_paginas` (seção 7).
export function lerTotalDePaginas(documento: PDFDocumentProxy): number {
  return documento.numPages
}
