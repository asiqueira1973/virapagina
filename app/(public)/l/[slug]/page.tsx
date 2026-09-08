// /l/[slug] — página pública de leitura de um livro (spec seção 10, épicos 8.3 e 8.4).
//
// Os metadados são lidos no servidor para render inicial e para as meta tags de
// compartilhamento; o PDF em si é buscado pelo navegador na rota de proxy. Slug
// inexistente, ou rascunho pedido por quem não é admin, cai no 404 desta pasta
// (regra 11.4). Página consumer: sem menu lateral (seção 16).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookReader } from '@/components/reader/BookReader'
import { livroVisivelPara } from '@/lib/books'
import { isAdminRequest } from '@/lib/google/auth'
import { findBookBySlug } from '@/lib/google/sheets'
import { COPY } from '@/lib/copy'
import type { Livro } from '@/types/livro'

// Busca o livro respeitando a visibilidade de quem está pedindo. A prévia do
// admin nunca vem do cache de 60 segundos (regra 11.7 e seção 13).
//
// Separa três desfechos de propósito: achou, não existe (ou é rascunho para um
// visitante) e falha de integração com o Google. Sem essa separação, uma planilha
// fora do ar apareceria como "esse livro não está disponível" — mentira que faria
// o Alexandre procurar o problema no livro errado (fluxo de exceção da seção 9).
type ResultadoDaBusca =
  | { estado: 'ok'; livro: Livro }
  | { estado: 'ausente' }
  | { estado: 'falha' }

async function buscarLivroVisivel(slug: string): Promise<ResultadoDaBusca> {
  try {
    const ehAdmin = await isAdminRequest()
    const livro = await findBookBySlug(slug, !ehAdmin)
    if (!livro || !livroVisivelPara(livro, ehAdmin)) return { estado: 'ausente' }
    return { estado: 'ok', livro }
  } catch (erro) {
    console.error(`Falha ao ler o livro ${slug} na planilha:`, erro)
    return { estado: 'falha' }
  }
}

// Meta tags de compartilhamento: é o card que aparece quando o link é colado no
// LinkedIn ou no WhatsApp — o caminho de distribuição do produto (seção 2).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const resultado = await buscarLivroVisivel(slug)
  if (resultado.estado !== 'ok') return { title: 'Livro não encontrado' }
  const livro = resultado.livro

  const descricao = livro.descricao ?? livro.subtitulo ?? `Por ${livro.autor}`
  return {
    title: livro.titulo,
    description: descricao,
    openGraph: {
      title: livro.titulo,
      description: descricao,
      type: 'book',
      url: `/l/${livro.slug}`,
      images: livro.capa_drive_id ? [`/api/livros/${livro.slug}/capa`] : undefined,
    },
    // Rascunho em prévia não pode ser indexado por buscador.
    robots: livro.publicado === 'sim' ? undefined : { index: false, follow: false },
  }
}

export default async function LeitorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const resultado = await buscarLivroVisivel(slug)
  // Livro que não existe, ou rascunho para visitante, cai no 404 desta pasta
  // (critério 8.3). Falha de integração é outra coisa e tem outra mensagem.
  if (resultado.estado === 'ausente') notFound()
  if (resultado.estado === 'falha') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-tela px-6 text-center">
        <p className="text-[17px] font-medium text-tinta">{COPY.erroGenerico}</p>
        <Link
          href="/"
          className="rounded-[10px] bg-destaque px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-destaque-escuro"
        >
          Ver o catálogo
        </Link>
      </main>
    )
  }
  const livro = resultado.livro

  return (
    <div className="flex h-dvh flex-col bg-tinta">
      <header className="flex shrink-0 items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          aria-label="Voltar para o catálogo"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
        >
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
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>

        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-medium text-white">{livro.titulo}</h1>
          <p className="truncate text-[12px] text-white/55">
            {livro.autor}
            {livro.publicado === 'nao' ? ' · prévia de rascunho' : ''}
          </p>
        </div>
      </header>

      <BookReader slug={livro.slug} totalDePaginasConhecido={livro.total_paginas} />
    </div>
  )
}
