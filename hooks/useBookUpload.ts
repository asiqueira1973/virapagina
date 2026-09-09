'use client'

// Hook do envio de PDF do painel do autor (spec épico 8.2, fluxo da seção 9).
//
// O caminho do arquivo é: valida no navegador → abre uma sessão de upload pela
// nossa rota de servidor → envia os bytes direto para o Google com XHR, para ter
// barra de progresso real (critério 8.2) → devolve o que a rota de criação
// precisa. A credencial nunca sai do servidor.
import { useCallback, useRef, useState } from 'react'
import { COPY } from '@/lib/copy'
import { abrirPdfDeArquivo, gerarCapaPngBase64, lerTotalDePaginas } from '@/lib/pdf/render'

// Teto da regra 11.2. A rejeição acontece antes de qualquer byte subir.
const TAMANHO_MAXIMO_BYTES = 100 * 1024 * 1024

// Etapas que a tela mostra ao autor enquanto o envio acontece.
export type EtapaEnvio = 'ocioso' | 'lendo' | 'enviando' | 'salvando'

// O que a leitura do PDF e o upload produzem, e que vai no corpo do POST.
export interface ResultadoEnvio {
  // Id do livro: vem da sessão de upload, porque o arquivo precisa nascer na
  // pasta definitiva — `livros/<dono>/<livro>/original.pdf` — antes de o
  // documento existir.
  livro_id: string
  arquivo_pdf_tamanho_bytes: number
  total_paginas: number | null
  capa_base64: string | null
}

// Valida o arquivo escolhido antes de subir (critério 8.2 e regra 11.2).
// Devolve a mensagem de erro ou null quando o arquivo serve.
export function validarArquivoPdf(arquivo: File): string | null {
  const ehPdf = arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf')
  if (!ehPdf) return COPY.uploadNaoPdf
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) return COPY.uploadGrandeDemais
  return null
}

// Envia os bytes para a URL da sessão, reportando o progresso real. XHR em vez
// de fetch porque só ele expõe evento de progresso de upload.
function enviarBytes(
  uploadUrl: string,
  arquivo: File,
  aoProgredir: (fracao: number) => void,
  registrarXhr: (xhr: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const xhr = new XMLHttpRequest()
    registrarXhr(xhr)
    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', 'application/pdf')

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) aoProgredir(evento.loaded / evento.total)
    }
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        rejeitar(new Error(`Storage recusou o upload: ${xhr.status}`))
        return
      }
      resolver()
    }
    // Conexão que cai no meio cai aqui — o formulário mostra o erro e mantém os
    // campos preenchidos (fluxo de exceção da seção 9).
    xhr.onerror = () => rejeitar(new Error('Falha de rede durante o upload'))
    xhr.onabort = () => rejeitar(new Error('Upload cancelado'))

    xhr.send(arquivo)
  })
}

export function useBookUpload() {
  const [etapa, setEtapa] = useState<EtapaEnvio>('ocioso')
  const [progresso, setProgresso] = useState(0)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  // Lê o PDF, gera a capa e sobe o arquivo. `livroExistente` só é passado ao
  // substituir o PDF de um livro que já existe — assim o arquivo novo cai na
  // mesma pasta e sobrescreve o antigo (critério 8.2).
  const enviarPdf = useCallback(
    async (arquivo: File, livroExistente?: string): Promise<ResultadoEnvio> => {
      setProgresso(0)

      // 1. Lê o arquivo no navegador: total de páginas e capa da primeira
      // página (regra 11.1). Falha aqui não impede o upload — os campos são
      // anuláveis e não bloqueiam a publicação.
      setEtapa('lendo')
      let totalPaginas: number | null = null
      let capaBase64: string | null = null
      try {
        const documento = await abrirPdfDeArquivo(arquivo)
        totalPaginas = lerTotalDePaginas(documento)
        capaBase64 = await gerarCapaPngBase64(documento)
      } catch (erro) {
        console.error('Falha ao ler o PDF no navegador:', erro)
      }

      // 2. Abre a sessão de upload pela nossa rota de servidor, que também
      // confere o limite do plano antes de deixar qualquer byte subir.
      setEtapa('enviando')
      const resposta = await fetch('/api/conta/livros/sessao-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mimeType: 'application/pdf',
          tamanhoBytes: arquivo.size,
          ...(livroExistente ? { livro_id: livroExistente } : {}),
        }),
      })
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null)
        throw new Error(corpo?.erro ?? COPY.erroDeUpload)
      }
      const { uploadUrl, livro_id: livroId } = await resposta.json()

      // 3. Envia os bytes direto para o Google, com progresso real.
      await enviarBytes(uploadUrl, arquivo, setProgresso, (xhr) => {
        xhrRef.current = xhr
      })

      setEtapa('salvando')
      return {
        livro_id: livroId,
        arquivo_pdf_tamanho_bytes: arquivo.size,
        total_paginas: totalPaginas,
        capa_base64: capaBase64,
      }
    },
    [],
  )

  // Volta o hook ao estado inicial depois de um erro, para o autor tentar de novo.
  const reiniciar = useCallback(() => {
    xhrRef.current?.abort()
    xhrRef.current = null
    setEtapa('ocioso')
    setProgresso(0)
  }, [])

  return { etapa, progresso, enviarPdf, reiniciar, setEtapa }
}
