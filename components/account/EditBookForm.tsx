'use client'

// Tela de edição de um livro (spec seção 10, épico 8.2). Reúne quatro coisas que
// o critério 8.2 trata como ações separadas: editar metadados, publicar ou
// despublicar, substituir o PDF e excluir.
//
// Editar metadados nunca exige reenviar o PDF — trocar de arquivo é a ação
// "Substituir PDF", com seu próprio botão.
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  AvisoDeErro,
  BarraDeProgresso,
  BookFormFields,
  type MetadadosEmEdicao,
} from '@/components/account/BookFormFields'
import { ConfirmDialog } from '@/components/account/ConfirmDialog'
import { PdfPicker } from '@/components/account/PdfPicker'
import { StatusBadge } from '@/components/account/StatusBadge'
import { useBookUpload } from '@/hooks/useBookUpload'
import { COPY } from '@/lib/copy'
import { formatarData, formatarTamanho } from '@/lib/format'
import { slugify } from '@/lib/slug'
import type { Livro } from '@/types/livro'

export function EditBookForm({ livro, handle }: { livro: Livro; handle: string }) {
  const router = useRouter()
  const { etapa, progresso, enviarPdf, reiniciar } = useBookUpload()

  const [valores, setValores] = useState<MetadadosEmEdicao>({
    titulo: livro.titulo,
    subtitulo: livro.subtitulo ?? '',
    slug: livro.slug,
    autor: livro.autor,
    descricao: livro.descricao ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [erroDeSlug, setErroDeSlug] = useState<string | null>(null)
  const [sugestaoDeSlug, setSugestaoDeSlug] = useState<string | null>(null)
  const [mensagemDeSucesso, setMensagemDeSucesso] = useState<string | null>(null)
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null)
  const [confirmacao, setConfirmacao] = useState<'excluir' | 'trocar-slug' | null>(null)

  const enviando = etapa !== 'ocioso'
  const ocupado = salvando || enviando
  const slugEfetivo = slugify(valores.slug || valores.titulo)
  const estaPublicado = livro.publicado

  function mudarCampo(campo: keyof MetadadosEmEdicao, valor: string) {
    if (campo === 'slug') {
      setErroDeSlug(null)
      setSugestaoDeSlug(null)
    }
    setMensagemDeSucesso(null)
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }))
  }

  // Grava os metadados. O aviso de troca de link aparece antes disso, quando o
  // livro já está publicado e o slug mudou (critério 8.2).
  async function salvarMetadados() {
    setErroGeral(null)
    setErroDeSlug(null)
    setSugestaoDeSlug(null)
    setMensagemDeSucesso(null)
    setSalvando(true)
    try {
      const resposta = await fetch(`/api/conta/livros/${livro.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...valores, slug: slugEfetivo }),
      })
      if (resposta.status === 409) {
        const corpo = await resposta.json()
        setErroDeSlug(corpo.erro ?? COPY.slugDuplicado)
        setSugestaoDeSlug(corpo.sugestao ?? null)
        return
      }
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null)
        setErroGeral(corpo?.erro ?? COPY.erroGenerico)
        return
      }
      setMensagemDeSucesso('Alterações salvas.')
      router.refresh()
    } catch (erro) {
      console.error('Falha ao salvar metadados:', erro)
      setErroGeral(COPY.erroGenerico)
    } finally {
      setSalvando(false)
    }
  }

  function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault()
    // Trocar o link de um livro publicado quebra quem tem o link antigo — por
    // isso exige confirmação explícita (critério 8.2).
    if (estaPublicado && slugEfetivo !== livro.slug) {
      setConfirmacao('trocar-slug')
      return
    }
    void salvarMetadados()
  }

  // Publicar e despublicar são o único par de estados que existe (seção 12).
  async function alternarPublicacao() {
    setErroGeral(null)
    setMensagemDeSucesso(null)
    setSalvando(true)
    try {
      const acao = estaPublicado ? 'despublicar' : 'publicar'
      const resposta = await fetch(`/api/conta/livros/${livro.id}/${acao}`, { method: 'POST' })
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null)
        setErroGeral(corpo?.erro ?? COPY.erroGenerico)
        return
      }
      router.refresh()
    } catch (erro) {
      console.error('Falha ao alternar publicação:', erro)
      setErroGeral(COPY.erroGenerico)
    } finally {
      setSalvando(false)
    }
  }

  // Substituir o PDF é ação separada da edição de metadados (critério 8.2).
  async function substituirPdf() {
    if (!novoArquivo) return
    setErroGeral(null)
    setMensagemDeSucesso(null)
    try {
      // Passa o id do livro para o arquivo novo cair na mesma pasta e
      // sobrescrever o antigo (critério 8.2).
      const enviado = await enviarPdf(novoArquivo, livro.id)
      const resposta = await fetch(`/api/conta/livros/${livro.id}/substituir-pdf`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(enviado),
      })
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null)
        setErroGeral(corpo?.erro ?? COPY.erroGenerico)
        reiniciar()
        return
      }
      setNovoArquivo(null)
      reiniciar()
      setMensagemDeSucesso('PDF substituído.')
      router.refresh()
    } catch (erro) {
      console.error('Falha ao substituir o PDF:', erro)
      setErroGeral(COPY.erroDeUpload)
      reiniciar()
    }
  }

  // Exclusão definitiva, sem lixeira (assunção 24.7 e regra 11.6).
  async function excluir() {
    setConfirmacao(null)
    setErroGeral(null)
    setSalvando(true)
    try {
      const resposta = await fetch(`/api/conta/livros/${livro.id}`, { method: 'DELETE' })
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null)
        setErroGeral(corpo?.erro ?? COPY.erroGenerico)
        return
      }
      router.push('/conta/livros')
      router.refresh()
    } catch (erro) {
      console.error('Falha ao excluir o livro:', erro)
      setErroGeral(COPY.erroGenerico)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-9 lg:flex-row">
        <form onSubmit={aoSubmeter} className="flex max-w-[560px] flex-1 flex-col gap-6">
          {erroGeral ? <AvisoDeErro mensagem={erroGeral} /> : null}
          {mensagemDeSucesso ? (
            <p className="rounded-lg border border-hairline bg-superficie-suave px-3.5 py-3 text-[13px] text-tinta-media">
              {mensagemDeSucesso}
            </p>
          ) : null}

          <BookFormFields
            handle={handle}
            valores={valores}
            aoMudar={mudarCampo}
            erroDeSlug={erroDeSlug}
            sugestaoDeSlug={sugestaoDeSlug}
            aoAceitarSugestao={(slug) => {
              setValores((anteriores) => ({ ...anteriores, slug }))
              setErroDeSlug(null)
              setSugestaoDeSlug(null)
            }}
            desabilitado={ocupado}
          />

          <div>
            <button
              type="submit"
              disabled={ocupado}
              className="cursor-pointer rounded-[10px] bg-acao px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-acao-clara disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>

          <div className="border-t border-hairline pt-6">
            <h2 className="mb-1 text-[15px] font-semibold">Substituir PDF</h2>
            <p className="mb-4 text-[12px] text-tinta-apagada">
              Troca o arquivo mantendo os metadados. A capa e o total de páginas são
              recalculados a partir do novo PDF.
            </p>
            <PdfPicker
              arquivo={novoArquivo}
              aoEscolher={(escolhido) => {
                setNovoArquivo(escolhido)
                setErroGeral(null)
              }}
              aoRejeitar={setErroGeral}
              desabilitado={ocupado}
              rotulo=""
            />
            {enviando ? (
              <div className="mt-4">
                <BarraDeProgresso
                  fracao={progresso}
                  rotulo={etapa === 'lendo' ? 'Lendo o PDF' : 'Enviando o arquivo'}
                />
              </div>
            ) : null}
            {novoArquivo && !enviando ? (
              <button
                type="button"
                onClick={substituirPdf}
                className="mt-4 cursor-pointer rounded-[10px] border border-hairline-forte bg-superficie px-3.5 py-2 text-[13px] font-medium text-tinta-media transition-colors hover:bg-tela"
              >
                Substituir PDF
              </button>
            ) : null}
          </div>

          <div className="border-t border-hairline pt-6">
            <h2 className="mb-1 text-[15px] font-semibold text-perigo">Excluir livro</h2>
            <p className="mb-4 text-[12px] text-tinta-apagada">
              Remove a linha da planilha e os arquivos do Drive. Não há como desfazer.
            </p>
            <button
              type="button"
              onClick={() => setConfirmacao('excluir')}
              disabled={ocupado}
              className="cursor-pointer rounded-[10px] border border-perigo-borda bg-perigo-fundo px-3.5 py-2 text-[13px] font-semibold text-perigo transition-colors hover:bg-[#fbe6e6] disabled:opacity-60"
            >
              Excluir
            </button>
          </div>
        </form>

        <aside className="w-full shrink-0 lg:w-[300px]">
          <div className="rounded-[14px] border border-hairline bg-superficie p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-tinta-media">Status</span>
              <StatusBadge publicado={livro.publicado} />
            </div>

            <button
              type="button"
              onClick={alternarPublicacao}
              disabled={ocupado || (!estaPublicado && livro.removido_por_denuncia)}
              className={`mb-3 w-full cursor-pointer rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                estaPublicado
                  ? 'border border-hairline-forte bg-superficie text-tinta-media hover:bg-tela'
                  : 'bg-acao text-white hover:bg-acao-clara'
              }`}
            >
              {estaPublicado ? 'Despublicar' : 'Publicar'}
            </button>

            {/* A prévia abre a página pública mesmo com o livro em rascunho: a
                sessão de admin é o que libera isso (passo 5 do fluxo da seção 9). */}
            <a
              href={`/${handle}/${livro.slug}`}
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-[10px] border border-hairline-forte bg-superficie px-4 py-2.5 text-center text-[13px] font-medium text-tinta-media transition-colors hover:bg-tela"
            >
              {estaPublicado ? 'Ver página pública' : 'Ver como ficaria'}
            </a>

            {/* Livro despublicado pelo admin da plataforma não volta pela mão
                do dono (regra 11.12). */}
            {livro.removido_por_denuncia ? (
              <p className="mt-3 rounded-lg border border-perigo-borda bg-perigo-fundo px-3 py-2.5 text-[12px] leading-relaxed text-perigo">
                {COPY.removidoPorDenuncia}
              </p>
            ) : null}

            <dl className="mt-5 flex flex-col gap-2.5 border-t border-hairline pt-4 text-[12px]">
              <Linha rotulo="Páginas" valor={livro.total_paginas ? String(livro.total_paginas) : '—'} />
              <Linha rotulo="Tamanho" valor={formatarTamanho(livro.arquivo_pdf_tamanho_bytes)} />
              <Linha rotulo="Criado em" valor={formatarData(livro.criado_em)} />
              <Linha rotulo="Atualizado em" valor={formatarData(livro.atualizado_em)} />
            </dl>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        aberto={confirmacao === 'excluir'}
        mensagem={COPY.confirmarExclusao(livro.titulo)}
        rotuloConfirmar="Excluir"
        perigo
        aoConfirmar={excluir}
        aoCancelar={() => setConfirmacao(null)}
      />

      <ConfirmDialog
        aberto={confirmacao === 'trocar-slug'}
        mensagem={COPY.avisoTrocaDeSlug}
        rotuloConfirmar="Continuar"
        aoConfirmar={() => {
          setConfirmacao(null)
          void salvarMetadados()
        }}
        aoCancelar={() => setConfirmacao(null)}
      />
    </>
  )
}

// Linha de informação do painel lateral da edição.
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-tinta-apagada">{rotulo}</dt>
      <dd className="text-tinta-media">{valor}</dd>
    </div>
  )
}
