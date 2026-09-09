'use client'

// Barra de ferramentas do leitor (spec épico 8.4): zoom, tela cheia, baixar,
// imprimir e compartilhar. Todo botão tem aria-label além do ícone, como exige o
// último critério do 8.4 e a seção 17.
import { useEffect, useState } from 'react'
import { COPY } from '@/lib/copy'
import { ZOOM_MAXIMO, ZOOM_MINIMO } from './ZoomControls'

export function FlipbookToolbar({
  handle,
  slug,
  zoom,
  aoAfastar,
  aoAproximar,
  paginaAtual,
  totalDePaginas,
  aoVoltar,
  aoAvancar,
  elementoTelaCheia,
}: {
  handle: string
  slug: string
  zoom: number
  aoAfastar: () => void
  aoAproximar: () => void
  paginaAtual: number
  totalDePaginas: number
  aoVoltar: () => void
  aoAvancar: () => void
  elementoTelaCheia: React.RefObject<HTMLDivElement | null>
}) {
  // A Fullscreen API não existe em todo navegador — no iOS Safari, por exemplo.
  // Onde não existe, o botão fica oculto em vez de quebrar (critério 8.4).
  const [temTelaCheia, setTemTelaCheia] = useState(false)
  const [emTelaCheia, setEmTelaCheia] = useState(false)
  const [avisoDeCopia, setAvisoDeCopia] = useState(false)

  useEffect(() => {
    setTemTelaCheia(typeof document !== 'undefined' && Boolean(document.fullscreenEnabled))
    function aoMudar() {
      setEmTelaCheia(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await elementoTelaCheia.current?.requestFullscreen()
      }
    } catch (erro) {
      console.error('Falha ao alternar tela cheia:', erro)
    }
  }

  // Compartilhar: menu nativo onde a Web Share API existe (o celular, que é a
  // maior parte da audiência — princípio 0.6); onde não existe, copia o link e
  // confirma (critério 8.4).
  async function compartilhar() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url })
        return
      } catch {
        // Cancelar o menu nativo não é erro — não há nada a fazer.
        return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setAvisoDeCopia(true)
      window.setTimeout(() => setAvisoDeCopia(false), 2500)
    } catch (erro) {
      console.error('Falha ao copiar o link:', erro)
    }
  }

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-tinta/85 px-2 py-1.5 backdrop-blur-md">
      <BotaoDaBarra rotulo="Página anterior" aoClicar={aoVoltar}>
        <Seta direcao="esquerda" />
      </BotaoDaBarra>

      <span className="px-2 text-[12px] font-medium text-white/85 tabular-nums" aria-live="polite">
        {paginaAtual} de {totalDePaginas}
      </span>

      <BotaoDaBarra rotulo="Próxima página" aoClicar={aoAvancar}>
        <Seta direcao="direita" />
      </BotaoDaBarra>

      <Separador />

      <BotaoDaBarra
        rotulo="Diminuir zoom"
        aoClicar={aoAfastar}
        desabilitado={zoom <= ZOOM_MINIMO}
      >
        <Icone caminho="M5 12h14" />
      </BotaoDaBarra>
      <span className="min-w-[44px] text-center text-[12px] font-medium text-white/85 tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <BotaoDaBarra
        rotulo="Aumentar zoom"
        aoClicar={aoAproximar}
        desabilitado={zoom >= ZOOM_MAXIMO}
      >
        <Icone caminho="M12 5v14M5 12h14" />
      </BotaoDaBarra>

      <Separador />

      {temTelaCheia ? (
        <BotaoDaBarra
          rotulo={emTelaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
          aoClicar={alternarTelaCheia}
        >
          <Icone caminho="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </BotaoDaBarra>
      ) : null}

      {/* Baixar e imprimir passam pela rota de proxy: a URL do Drive nunca
          aparece para o leitor (seção 4, critério 8.4). */}
      <BotaoDaBarra rotulo="Baixar o PDF" href={`/api/livros/${handle}/${slug}/pdf?download=1`}>
        <Icone caminho="M12 4v11M8 11l4 4 4-4M5 19h14" />
      </BotaoDaBarra>

      <BotaoDaBarra
        rotulo="Imprimir"
        href={`/api/livros/${handle}/${slug}/pdf`}
        abrirEmNovaAba
      >
        <Icone caminho="M7 9V4h10v5M7 19h10v-5H7v5M5 14h14a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1Z" />
      </BotaoDaBarra>

      <BotaoDaBarra rotulo="Compartilhar" aoClicar={compartilhar}>
        <Icone caminho="M12 4v11M8.5 7.5 12 4l3.5 3.5M5 13v6h14v-6" />
      </BotaoDaBarra>

      {avisoDeCopia ? (
        <span
          role="status"
          className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-tinta px-3 py-1.5 text-[12px] font-medium text-white"
        >
          {COPY.linkCopiado}
        </span>
      ) : null}
    </div>
  )
}

// Botão da barra: vira link quando tem href (baixar e imprimir), botão quando
// tem ação. Em qualquer caso leva rótulo acessível (critério 8.4).
function BotaoDaBarra({
  rotulo,
  aoClicar,
  href,
  abrirEmNovaAba,
  desabilitado,
  children,
}: {
  rotulo: string
  aoClicar?: () => void
  href?: string
  abrirEmNovaAba?: boolean
  desabilitado?: boolean
  children: React.ReactNode
}) {
  const estilo =
    'flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent'

  if (href) {
    return (
      <a
        href={href}
        aria-label={rotulo}
        title={rotulo}
        {...(abrirEmNovaAba ? { target: '_blank', rel: 'noreferrer' } : {})}
        className={estilo}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      aria-label={rotulo}
      title={rotulo}
      className={`cursor-pointer ${estilo}`}
    >
      {children}
    </button>
  )
}

function Separador() {
  return <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
}

function Icone({ caminho }: { caminho: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={caminho} />
    </svg>
  )
}

function Seta({ direcao }: { direcao: 'esquerda' | 'direita' }) {
  return (
    <Icone caminho={direcao === 'esquerda' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  )
}
