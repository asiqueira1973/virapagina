'use client'

// Visualizador flipbook (spec épicos 8.3 e 8.4). É o produto inteiro numa tela:
// o PDF original é renderizado página a página em canvas pelo PDF.js, e o
// react-pageflip cuida da animação de virar.
//
// O PDF nunca vira imagem no servidor (princípio 0.1) e nunca é buscado direto
// do Drive: vem sempre da rota de proxy /api/livros/[slug]/pdf (seção 4).
import HTMLFlipBook from 'react-pageflip'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import { abrirPdfDeUrl } from '@/lib/pdf/render'
import { COPY } from '@/lib/copy'
import { FlipbookToolbar } from './FlipbookToolbar'
import { PdfPage } from './PdfPage'
import { ZOOM_INICIAL, ajustarZoom } from './ZoomControls'

// Largura a partir da qual o livro abre em página dupla, espelhando um livro
// físico. Abaixo disso, página única (critério 8.3 e seção 17).
const LARGURA_DE_PAGINA_DUPLA = 1024

// Quantas páginas antes e depois da atual são desenhadas. Renderizar o livro
// inteiro de uma vez trava o celular (premissa técnica 1 da seção 4).
const JANELA_DE_RENDERIZACAO = 3

export function BookReader({
  handle,
  slug,
  totalDePaginasConhecido,
}: {
  handle: string
  slug: string
  totalDePaginasConhecido: number | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Referência do flipbook, usada pelos botões e pelas setas do teclado.
  // O tipo do react-pageflip é `any` na própria biblioteca.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipRef = useRef<any>(null)

  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null)
  const [totalDePaginas, setTotalDePaginas] = useState(totalDePaginasConhecido ?? 0)
  const [proporcao, setProporcao] = useState(1.414) // A4 em retrato, até o PDF dizer o contrário
  // Largura da página em pontos do PDF, base do cálculo da escala de renderização.
  const [larguraDoPdfEmPontos, setLarguraDoPdfEmPontos] = useState(595)
  const [paginaAtual, setPaginaAtual] = useState(0)
  const [zoom, setZoom] = useState(ZOOM_INICIAL)
  const [carregando, setCarregando] = useState(true)
  const [falhou, setFalhou] = useState(false)
  const [area, setArea] = useState({ largura: 0, altura: 0 })

  // 1. Carrega o PDF e mede a primeira página para saber a proporção do livro.
  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    setFalhou(false)

    abrirPdfDeUrl(`/api/livros/${handle}/${slug}/pdf`)
      .then(async (doc) => {
        if (cancelado) return
        const primeira = await doc.getPage(1)
        const viewport = primeira.getViewport({ scale: 1 })
        if (cancelado) return
        setProporcao(viewport.height / viewport.width)
        setLarguraDoPdfEmPontos(viewport.width)
        setTotalDePaginas(doc.numPages)
        setDocumento(doc)
        setCarregando(false)
      })
      .catch((erro) => {
        if (cancelado) return
        console.error('Falha ao carregar o PDF do livro:', erro)
        setFalhou(true)
        setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [handle, slug])

  // 2. Mede o espaço disponível. O livro é redimensionado a cada mudança de
  // tamanho para funcionar de 360px a 2560px (seção 17).
  //
  // ResizeObserver em vez de medir uma vez no mount: uma aba aberta em segundo
  // plano tem layout zerado até ser exibida, e uma medição única deixaria o
  // leitor em branco para sempre nesse caso — cenário comum quando o link chega
  // pelo LinkedIn ou pelo WhatsApp e a pessoa abre em nova aba (seção 2).
  useEffect(() => {
    const elemento = containerRef.current
    if (!elemento) return

    function medir() {
      if (!elemento) return
      setArea({ largura: elemento.clientWidth, altura: elemento.clientHeight })
    }

    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  // Página dupla só em tela larga; abaixo de 1024px, página única (critério 8.3).
  const paginaDupla = area.largura >= LARGURA_DE_PAGINA_DUPLA

  // 3. Calcula o tamanho de uma página. O zoom multiplica esse tamanho e o que
  // não couber vira rolagem — é assim que o zoom vale também como recurso de
  // acessibilidade visual (seção 17).
  const tamanho = useMemo(() => {
    if (area.largura === 0 || area.altura === 0) return { largura: 0, altura: 0 }
    const larguraDisponivel = paginaDupla ? area.largura / 2 : area.largura
    const porLargura = larguraDisponivel
    const porAltura = area.altura / proporcao
    const larguraBase = Math.floor(Math.min(porLargura, porAltura))
    return {
      largura: Math.max(120, Math.floor(larguraBase * zoom)),
      altura: Math.max(120, Math.floor(larguraBase * proporcao * zoom)),
    }
  }, [area, proporcao, paginaDupla, zoom])

  // Escala que o PDF.js usa para desenhar, já compensando telas de alta
  // densidade — sem isso a página fica borrada no celular.
  const escalaDeRenderizacao = useMemo(() => {
    if (tamanho.largura === 0 || larguraDoPdfEmPontos === 0) return 1
    // A densidade da tela é limitada em 2: acima disso o ganho visual não paga o
    // custo de memória num celular (premissa técnica 1 da seção 4).
    const densidade = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    return (tamanho.largura * densidade) / larguraDoPdfEmPontos
  }, [tamanho, larguraDoPdfEmPontos])

  const irParaAnterior = useCallback(() => {
    flipRef.current?.pageFlip()?.flipPrev()
  }, [])
  const irParaProxima = useCallback(() => {
    flipRef.current?.pageFlip()?.flipNext()
  }, [])

  // 4. Setas do teclado navegam entre páginas (critério 8.3).
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      // Não sequestra o teclado de quem está digitando num campo.
      const alvo = evento.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA'].includes(alvo.tagName)) return
      if (evento.key === 'ArrowLeft') irParaAnterior()
      if (evento.key === 'ArrowRight') irParaProxima()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [irParaAnterior, irParaProxima])

  const paginas = useMemo(
    () => Array.from({ length: totalDePaginas }, (_, indice) => indice + 1),
    [totalDePaginas],
  )

  const pronto = documento !== null && tamanho.largura > 0 && totalDePaginas > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* O container rola; o miolo tem largura e altura mínimas iguais às dele e
          cresce junto com o livro. Sem isso, com o zoom acima de 100% o topo da
          página fica inacessível — centralizar com flex esconde o que transborda
          para cima (regra 11.5). */}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
        <div className="flex h-max min-h-full w-max min-w-full items-center justify-center px-3 py-4">
        {falhou ? (
          <p className="text-[14px] text-tinta-apagada">{COPY.erroGenerico}</p>
        ) : !pronto ? (
          // Esqueleto enquanto o PDF carrega, nunca tela em branco (critério 8.3).
          <EsqueletoDoLivro carregando={carregando} />
        ) : (
          <HTMLFlipBook
            // Trocar o zoom ou o modo de página remonta o livro: o react-pageflip
            // mede o tamanho na inicialização. O startPage devolve o leitor para
            // onde ele estava, então o zoom persiste ao virar (critério 8.4).
            key={`${tamanho.largura}x${tamanho.altura}-${paginaDupla ? 'duplo' : 'unico'}`}
            ref={flipRef}
            startPage={paginaAtual}
            width={tamanho.largura}
            height={tamanho.altura}
            size="fixed"
            minWidth={120}
            maxWidth={4000}
            minHeight={120}
            maxHeight={4000}
            drawShadow
            flippingTime={700}
            // Em tela estreita o próprio react-pageflip assume o modo retrato.
            usePortrait={!paginaDupla}
            startZIndex={0}
            autoSize={false}
            maxShadowOpacity={0.35}
            // Capa e contracapa como páginas duras, igual a um livro de verdade.
            showCover
            mobileScrollSupport={false}
            clickEventForward={false}
            // Clique, arrasto e swipe vêm do próprio react-pageflip (critério 8.3).
            useMouseEvents
            swipeDistance={30}
            showPageCorners
            disableFlipByClick={false}
            className=""
            style={{}}
            onFlip={(evento: { data: number }) => setPaginaAtual(evento.data)}
          >
            {paginas.map((numero) => (
              <PdfPage
                key={numero}
                documento={documento}
                numero={numero}
                largura={tamanho.largura}
                altura={tamanho.altura}
                escala={escalaDeRenderizacao}
                deveRenderizar={Math.abs(numero - 1 - paginaAtual) <= JANELA_DE_RENDERIZACAO}
              />
            ))}
          </HTMLFlipBook>
        )}
        </div>
      </div>

      <div className="flex justify-center px-3 pb-5">
        <FlipbookToolbar
          handle={handle}
          slug={slug}
          zoom={zoom}
          aoAfastar={() => setZoom((atual) => ajustarZoom(atual, -1))}
          aoAproximar={() => setZoom((atual) => ajustarZoom(atual, 1))}
          paginaAtual={Math.min(paginaAtual + 1, Math.max(totalDePaginas, 1))}
          totalDePaginas={Math.max(totalDePaginas, 1)}
          aoVoltar={irParaAnterior}
          aoAvancar={irParaProxima}
          elementoTelaCheia={containerRef}
        />
      </div>
    </div>
  )
}

// Estado de carregamento do livro: a silhueta de uma página com pulsação,
// em vez de tela em branco (critério 8.3).
function EsqueletoDoLivro({ carregando }: { carregando: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`h-[60vh] max-h-[560px] w-[min(42vw,380px)] rounded-sm bg-white/70 shadow-lg ${
          carregando ? 'animate-pulse' : ''
        }`}
      />
      <p className="text-[13px] text-white/60">Carregando o livro…</p>
    </div>
  )
}
