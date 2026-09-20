'use client'

// Seletor do arquivo PDF, com arrastar-e-soltar e validação imediata
// (spec critério 8.2, regra 11.2). A rejeição de arquivo inválido acontece aqui,
// antes de qualquer byte subir.
import { useState } from 'react'
import { validarArquivoPdf } from '@/hooks/useBookUpload'
import { formatarTamanho } from '@/lib/format'

export function PdfPicker({
  arquivo,
  aoEscolher,
  aoRejeitar,
  desabilitado = false,
  rotulo = 'Arquivo PDF',
}: {
  arquivo: File | null
  aoEscolher: (arquivo: File) => void
  aoRejeitar: (mensagem: string) => void
  desabilitado?: boolean
  rotulo?: string
}) {
  const [arrastando, setArrastando] = useState(false)

  // Ponto único de validação: tanto o clique quanto o arrastar passam por aqui.
  function receber(arquivoRecebido: File | undefined) {
    if (!arquivoRecebido) return
    const erro = validarArquivoPdf(arquivoRecebido)
    if (erro) {
      aoRejeitar(erro)
      return
    }
    aoEscolher(arquivoRecebido)
  }

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-tinta-media">{rotulo}</span>
      <label
        onDragOver={(evento) => {
          evento.preventDefault()
          if (!desabilitado) setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(evento) => {
          evento.preventDefault()
          setArrastando(false)
          if (!desabilitado) receber(evento.dataTransfer.files[0])
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border border-dashed px-6 py-9 text-center transition-colors ${
          arrastando
            ? 'border-tinta bg-ativo'
            : 'border-traco-forte bg-superficie-2 hover:border-traco-forte'
        } ${desabilitado ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={desabilitado}
          className="sr-only"
          onChange={(evento) => receber(evento.target.files?.[0])}
        />
        {arquivo ? (
          <>
            <span className="text-[14px] font-medium text-tinta">{arquivo.name}</span>
            <span className="text-[12px] text-tinta-apagada">
              {formatarTamanho(arquivo.size)} · clique para trocar
            </span>
          </>
        ) : (
          <>
            <span className="text-[14px] font-medium text-tinta-media">
              Arraste o PDF aqui ou clique para escolher
            </span>
            <span className="text-[12px] text-tinta-apagada">Até 100 MB</span>
          </>
        )}
      </label>
    </div>
  )
}
