'use client'

// Uma página do livro dentro do flipbook (spec épico 8.3).
//
// Precisa ser um componente com forwardRef porque o react-pageflip guarda uma
// referência ao elemento de cada página para animar a virada. O canvas só é
// desenhado quando a página está perto da que está sendo lida: renderizar as 44
// páginas de uma vez travaria o celular (premissa técnica 1 da seção 4).
import { forwardRef, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import { renderizarPagina } from '@/lib/pdf/render'

interface PdfPageProps {
  documento: PDFDocumentProxy | null
  numero: number
  largura: number
  altura: number
  // Escala de renderização já com o zoom aplicado (regra 11.5).
  escala: number
  deveRenderizar: boolean
}

export const PdfPage = forwardRef<HTMLDivElement, PdfPageProps>(function PdfPage(
  { documento, numero, largura, altura, escala, deveRenderizar },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [desenhada, setDesenhada] = useState(false)

  // O PDF.js recusa duas renderizações ao mesmo tempo no mesmo canvas, e só
  // libera o canvas quando a anterior termina — cancelar não basta, é preciso
  // esperar. Estas duas referências enfileiram os desenhos: cada um só começa
  // depois que o anterior soltou o canvas. Sem isso, mexer no zoom rápido deixa
  // a página em branco.
  const filaRef = useRef<Promise<void>>(Promise.resolve())
  const cancelarAnteriorRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!documento || !deveRenderizar || !canvas) return

    let cancelado = false
    // Pede para o desenho que estiver em curso parar; a espera vem logo abaixo.
    cancelarAnteriorRef.current?.()

    filaRef.current = filaRef.current
      .catch(() => {})
      .then(async () => {
        if (cancelado) return
        const desenho = renderizarPagina(documento, numero, canvas, escala)
        cancelarAnteriorRef.current = desenho.cancelar
        try {
          await desenho.promessa
          // Chegar aqui significa que os pixels já estão no canvas — um desenho
          // cancelado sai pelo catch. Não dá para condicionar isto a `cancelado`:
          // um efeito posterior marca o anterior como cancelado depois que ele já
          // pintou, e a página ficaria desenhada mas invisível.
          setDesenhada(true)
        } catch (erro: unknown) {
          // Cancelamento é o caminho esperado quando o zoom muda no meio do
          // desenho — não é erro e não vai para o log.
          const nome = (erro as { name?: string })?.name
          if (cancelado || nome === 'RenderingCancelledException') return
          // Uma página que não desenha não pode derrubar o livro inteiro.
          console.error(`Falha ao renderizar a página ${numero}:`, erro)
        }
      })

    return () => {
      cancelado = true
      cancelarAnteriorRef.current?.()
    }
  }, [documento, numero, escala, deveRenderizar])

  return (
    <div
      ref={ref}
      className="overflow-hidden bg-white"
      style={{ width: largura, height: altura }}
    >
      <canvas
        ref={canvasRef}
        aria-label={`Página ${numero}`}
        className="block h-full w-full"
        style={{ opacity: desenhada ? 1 : 0, transition: 'opacity 150ms' }}
      />
    </div>
  )
})
