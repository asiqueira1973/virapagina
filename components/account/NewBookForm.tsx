'use client'

// Tela de criação de livro (spec épico 8.2 e fluxo da seção 9).
//
// A ordem importa: o slug é checado antes de o arquivo subir, para não deixar um
// PDF órfão no Drive quando o link já está em uso; e a linha só é escrita na
// planilha depois que o upload termina com sucesso (fluxo de exceção da seção 9).
// Em qualquer falha, os campos preenchidos permanecem na tela.
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  AvisoDeErro,
  BarraDeProgresso,
  BookFormFields,
  type MetadadosEmEdicao,
} from '@/components/account/BookFormFields'
import { PdfPicker } from '@/components/account/PdfPicker'
import { useBookUpload, type ResultadoEnvio } from '@/hooks/useBookUpload'
import { COPY } from '@/lib/copy'
import { slugify } from '@/lib/slug'

const VALORES_INICIAIS: MetadadosEmEdicao = {
  titulo: '',
  subtitulo: '',
  slug: '',
  autor: '',
  descricao: '',
}

export function NewBookForm({ handle }: { handle: string }) {
  const router = useRouter()
  const { etapa, progresso, enviarPdf, reiniciar } = useBookUpload()

  const [valores, setValores] = useState<MetadadosEmEdicao>(VALORES_INICIAIS)
  // Guarda se o admin já mexeu no slug à mão: a partir daí o título para de
  // sobrescrever o campo (regra 11.3 — sugerido, mas sempre editável).
  const [slugEditadoAMao, setSlugEditadoAMao] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [erroDeSlug, setErroDeSlug] = useState<string | null>(null)
  const [sugestaoDeSlug, setSugestaoDeSlug] = useState<string | null>(null)
  // Se o PDF já subiu e o salvamento falhou depois, o id é reaproveitado para
  // não enviar o arquivo de novo numa segunda tentativa.
  const [envioConcluido, setEnvioConcluido] = useState<ResultadoEnvio | null>(null)

  const enviando = etapa !== 'ocioso'
  const slugEfetivo = slugify(valores.slug || valores.titulo)

  function mudarCampo(campo: keyof MetadadosEmEdicao, valor: string) {
    if (campo === 'slug') {
      setSlugEditadoAMao(true)
      setErroDeSlug(null)
      setSugestaoDeSlug(null)
    }
    setValores((anteriores) => {
      const proximos = { ...anteriores, [campo]: valor }
      // Enquanto o admin não tocar no slug, ele acompanha o título.
      if (campo === 'titulo' && !slugEditadoAMao) proximos.slug = slugify(valor)
      return proximos
    })
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErroGeral(null)
    setErroDeSlug(null)
    setSugestaoDeSlug(null)

    if (!valores.titulo.trim()) {
      setErroGeral('Informe o título do livro.')
      return
    }
    if (!arquivo && !envioConcluido) {
      setErroGeral(COPY.uploadNaoPdf)
      return
    }

    try {
      // 1. Slug livre? A checagem definitiva é a do POST, mas antecipá-la aqui
      // evita subir um arquivo que seria descartado (critério 8.2).
      const checagem = await fetch(
        `/api/conta/livros/slug-disponivel?slug=${encodeURIComponent(slugEfetivo)}`,
      )
      if (checagem.ok) {
        const resultado = await checagem.json()
        if (resultado.valido && !resultado.disponivel) {
          setErroDeSlug(COPY.slugDuplicado)
          setSugestaoDeSlug(resultado.sugestao)
          return
        }
      }

      // 2. Sobe o PDF (ou reaproveita o que já subiu numa tentativa anterior).
      const enviado = envioConcluido ?? (await enviarPdf(arquivo as File))
      setEnvioConcluido(enviado)

      // 3. Só agora a linha entra na planilha, sempre como rascunho (seção 12).
      const resposta = await fetch('/api/conta/livros', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          titulo: valores.titulo,
          subtitulo: valores.subtitulo,
          slug: slugEfetivo,
          autor: valores.autor,
          descricao: valores.descricao,
          ...enviado,
        }),
      })

      if (resposta.status === 409) {
        const corpo = await resposta.json()
        setErroDeSlug(corpo.erro ?? COPY.slugDuplicado)
        setSugestaoDeSlug(corpo.sugestao ?? null)
        reiniciar()
        return
      }
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null)
        setErroGeral(corpo?.erro ?? COPY.erroGenerico)
        reiniciar()
        return
      }

      // 4. Vai para a tela de edição, onde estão a prévia e o botão Publicar
      // (passo 5 do fluxo da seção 9).
      const { livro } = await resposta.json()
      router.push(`/conta/livros/${livro.id}`)
      router.refresh()
    } catch (erro) {
      console.error('Falha ao criar o livro:', erro)
      setErroGeral(COPY.erroDeUpload)
      reiniciar()
    }
  }

  const rotuloDaEtapa =
    etapa === 'lendo'
      ? 'Lendo o PDF e gerando a capa'
      : etapa === 'enviando'
        ? 'Enviando o arquivo'
        : 'Salvando o livro'

  return (
    <form onSubmit={salvar} className="flex max-w-[560px] flex-col gap-6">
      {erroGeral ? <AvisoDeErro mensagem={erroGeral} /> : null}

      <BookFormFields
        handle={handle}
        valores={valores}
        aoMudar={mudarCampo}
        erroDeSlug={erroDeSlug}
        sugestaoDeSlug={sugestaoDeSlug}
        aoAceitarSugestao={(slug) => {
          setSlugEditadoAMao(true)
          setValores((anteriores) => ({ ...anteriores, slug }))
          setErroDeSlug(null)
          setSugestaoDeSlug(null)
        }}
        desabilitado={enviando}
      />

      <PdfPicker
        arquivo={arquivo}
        aoEscolher={(escolhido) => {
          setArquivo(escolhido)
          setEnvioConcluido(null)
          setErroGeral(null)
        }}
        aoRejeitar={setErroGeral}
        desabilitado={enviando}
      />

      {enviando ? <BarraDeProgresso fracao={progresso} rotulo={rotuloDaEtapa} /> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="cursor-pointer rounded-[10px] bg-acao px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-acao-clara disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Salvar como rascunho'}
        </button>
        <p className="text-[12px] text-tinta-apagada">
          O livro nasce como rascunho. A publicação é o próximo passo.
        </p>
      </div>
    </form>
  )
}
