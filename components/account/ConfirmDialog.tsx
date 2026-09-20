'use client'

// Diálogo de confirmação usado nas duas ações que o critério 8.2 exige confirmar
// explicitamente: excluir um livro (com o título nomeado) e trocar o slug de um
// livro já publicado. Não usa window.confirm porque a copy é fixa pela seção
// 14–15 e precisa aparecer exatamente como está escrita lá.
import { useEffect, useRef } from 'react'

export function ConfirmDialog({
  aberto,
  mensagem,
  rotuloConfirmar,
  perigo = false,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean
  mensagem: string
  rotuloConfirmar: string
  perigo?: boolean
  aoConfirmar: () => void
  aoCancelar: () => void
}) {
  const botaoRef = useRef<HTMLButtonElement>(null)

  // Foco vai para o botão de confirmar ao abrir, e Esc cancela — o diálogo
  // precisa ser operável só pelo teclado (seção 17).
  useEffect(() => {
    if (!aberto) return
    botaoRef.current?.focus()
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoCancelar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto, aoCancelar])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/25 px-5">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={mensagem}
        className="w-full max-w-[420px] rounded-2xl border border-traco bg-superficie p-6 shadow-xl"
      >
        <p className="mb-5 text-[14px] leading-relaxed text-tinta">{mensagem}</p>
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={aoCancelar}
            className="cursor-pointer rounded-full border border-traco-forte bg-superficie px-3.5 py-2 text-[13px] font-medium text-tinta-media transition-colors hover:bg-ativo/50"
          >
            Cancelar
          </button>
          <button
            ref={botaoRef}
            type="button"
            onClick={aoConfirmar}
            className={`cursor-pointer rounded-full px-3.5 py-2 text-[13px] font-semibold text-white transition-colors ${
              perigo ? 'bg-perigo hover:bg-perigo-escuro' : 'bg-tinta hover:bg-tinta-media'
            }`}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
