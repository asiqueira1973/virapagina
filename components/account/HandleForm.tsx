'use client'

// Formulário de escolha do endereço público (spec épico 8.1).
//
// É a única tela que roda antes de a conta ter handle, e não é pulável: sem
// handle não existe URL pública, logo não existe produto. A escolha é definitiva
// (regra 11.10), e a tela diz isso antes de a pessoa decidir.
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { COPY } from '@/lib/copy'
import { slugify } from '@/lib/slug'

// Mesmo formato que o servidor aplica (critério 8.1).
const FORMATO = /^[a-z0-9-]{3,30}$/

export function HandleForm({
  sugestaoInicial,
  dominio,
}: {
  sugestaoInicial: string
  // Vem do servidor por prop: componente de cliente não lê NEXTAUTH_URL, e o
  // domínio não pode ser escrito à mão numa tela que decide algo permanente.
  dominio: string
}) {
  const router = useRouter()
  const [handle, setHandle] = useState(sugestaoInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [sugestao, setSugestao] = useState<string | null>(null)
  const [disponivel, setDisponivel] = useState(false)
  const [checando, setChecando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const formatoOk = FORMATO.test(handle)

  // Checa a disponibilidade enquanto a pessoa digita, com uma pausa para não
  // disparar uma requisição por tecla. A checagem definitiva é a do POST.
  useEffect(() => {
    if (!formatoOk) {
      setDisponivel(false)
      setSugestao(null)
      return
    }
    setChecando(true)
    const relogio = window.setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/conta/handle?handle=${encodeURIComponent(handle)}`)
        if (!resposta.ok) return
        const resultado = await resposta.json()
        setDisponivel(Boolean(resultado.disponivel))
        setSugestao(resultado.disponivel ? null : (resultado.sugestao ?? null))
        setErro(resultado.disponivel ? null : COPY.handleIndisponivel)
      } catch {
        // Sem rede, a checagem antecipada some e o POST decide.
      } finally {
        setChecando(false)
      }
    }, 350)
    return () => window.clearTimeout(relogio)
  }, [handle, formatoOk])

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    if (!formatoOk) {
      setErro(COPY.handleInvalido)
      return
    }
    setSalvando(true)
    try {
      const resposta = await fetch('/api/conta/handle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle }),
      })
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null)
        setErro(corpo?.erro ?? COPY.erroGenerico)
        setSugestao(corpo?.sugestao ?? null)
        return
      }
      router.push('/conta/livros')
      router.refresh()
    } catch (erroDeRede) {
      console.error('Falha ao definir o endereço:', erroDeRede)
      setErro(COPY.erroGenerico)
    } finally {
      setSalvando(false)
    }
  }

  const mostrarErro = Boolean(erro) && !checando

  return (
    <form onSubmit={salvar}>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-tinta-media">Endereço</span>
        <div
          className={`flex items-center overflow-hidden rounded-[10px] border bg-superficie ${
            mostrarErro ? 'border-perigo-borda' : 'border-hairline-forte focus-within:border-destaque'
          }`}
        >
          <span className="shrink-0 border-r border-hairline bg-tela px-3 py-[11px] text-[13px] text-tinta-apagada">
            {dominio}/
          </span>
          <input
            type="text"
            value={handle}
            onChange={(evento) => {
              // O que a pessoa digita já é normalizado para o formato aceito —
              // recusar depois o que a tela deixou escrever é armadilha.
              setHandle(slugify(evento.target.value).slice(0, 30))
              setErro(null)
            }}
            disabled={salvando}
            spellCheck={false}
            autoFocus
            className="min-w-0 flex-1 px-3 py-[11px] text-[14px] outline-none"
          />
          {disponivel && !checando ? (
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="Disponível"
              className="mr-3 shrink-0 text-publicado"
            >
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          ) : null}
        </div>
      </label>

      {mostrarErro ? (
        <p role="alert" className="mt-2.5 text-[13px] text-perigo">
          {erro}
          {sugestao ? (
            <>
              {' '}
              <button
                type="button"
                onClick={() => {
                  setHandle(sugestao)
                  setErro(null)
                  setSugestao(null)
                }}
                className="cursor-pointer font-medium text-destaque underline"
              >
                Usar {sugestao}
              </button>
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-2.5 text-[12px] text-tinta-apagada">{COPY.handleInvalido}</p>
      )}

      <button
        type="submit"
        disabled={salvando || !formatoOk}
        className="mt-5 w-full cursor-pointer rounded-[10px] bg-destaque px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-destaque-escuro disabled:cursor-not-allowed disabled:opacity-60"
      >
        {salvando ? 'Salvando…' : 'Continuar'}
      </button>

      <div className="mt-5 flex items-start gap-2.5 border-t border-hairline pt-4">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-px shrink-0 text-tinta-apagada"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v5h1" />
        </svg>
        <p className="text-[12px] leading-relaxed text-tinta-apagada">{COPY.handleDefinitivo}</p>
      </div>
    </form>
  )
}
