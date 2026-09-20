// /<handle>/<slug> — leitor público (spec seção 10, épicos 8.3 e 8.4).
//
// Os metadados são lidos no servidor, para o render inicial e para o card de
// compartilhamento — que é o canal de distribuição do produto. O PDF é buscado
// pelo navegador na rota de proxy. Handle inexistente, slug inexistente e
// rascunho de outra pessoa caem no mesmo 404, de propósito (regra 11.4).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookReader } from '@/components/reader/BookReader'
import { resolverLivroPublico } from '@/lib/books'
import { versaoDosArquivos } from '@/lib/cache'
import { COPY } from '@/lib/copy'
import { sessaoAtual } from '@/lib/guards'
import { LEITOR_ANONIMO, registrarEvento } from '@/lib/visao'
import type { Livro, Usuario } from '@/types/livro'

type Resultado =
  | { estado: 'ok'; livro: Livro; dono: Usuario }
  | { estado: 'ausente' }
  | { estado: 'falha' }

async function buscarLivro(handle: string, slug: string): Promise<Resultado> {
  try {
    const sessao = await sessaoAtual()
    const resolvido = await resolverLivroPublico(handle.toLowerCase(), slug, sessao?.id ?? null)
    if (!resolvido) return { estado: 'ausente' }
    return { estado: 'ok', ...resolvido }
  } catch (erro) {
    console.error(`Falha ao ler o livro ${handle}/${slug}:`, erro)
    return { estado: 'falha' }
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>
}): Promise<Metadata> {
  const { handle, slug } = await params
  const resultado = await buscarLivro(handle, slug)
  if (resultado.estado !== 'ok') return { title: 'Livro não encontrado' }

  const { livro } = resultado
  const descricao = livro.descricao ?? livro.subtitulo ?? `Por ${livro.autor}`
  return {
    title: livro.titulo,
    description: descricao,
    openGraph: {
      title: livro.titulo,
      description: descricao,
      type: 'book',
      url: `/${handle}/${slug}`,
      // Com a versão: sem ela o card de compartilhamento continuaria mostrando a
      // capa antiga depois de substituir o PDF (critério 8.2).
      images: livro.capa_caminho
        ? [`/api/livros/${handle}/${slug}/capa?v=${versaoDosArquivos(livro)}`]
        : undefined,
    },
    // Rascunho em prévia não pode ser indexado por buscador.
    robots: livro.publicado ? undefined : { index: false, follow: false },
  }
}

export default async function LeitorPage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>
}) {
  const { handle, slug } = await params
  const resultado = await buscarLivro(handle, slug)
  if (resultado.estado === 'ausente') notFound()

  if (resultado.estado === 'falha') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-tela px-6 text-center">
        <p className="text-[17px] font-medium text-tinta">{COPY.erroGenerico}</p>
        <Link
          href="/"
          className="rounded-[10px] bg-acao px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-acao-clara"
        >
          Ir para a home
        </Link>
      </main>
    )
  }

  const { livro, dono } = resultado

  // A leitura é o uso que importa medir: o produto entrega um link para alguém
  // folhear. Só conta o que está publicado — a prévia do dono sobre rascunho é
  // trabalho de autor, não leitura (regra 11.4).
  if (livro.publicado) {
    registrarEvento({
      nome: 'livro_lido',
      quem: LEITOR_ANONIMO,
      tela: 'Leitor',
      descricao: 'abriu um livro público no leitor',
      propriedades: {
        endereco: `/${dono.handle ?? handle}/${livro.slug}`,
        autor: dono.handle,
        total_paginas: livro.total_paginas,
      },
    })
  }

  return (
    <div className="flex h-dvh flex-col bg-tinta">
      <header className="flex shrink-0 items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href={`/${dono.handle}`}
          aria-label="Voltar para a vitrine do autor"
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
            {livro.publicado ? '' : ' · prévia de rascunho'}
          </p>
        </div>
      </header>

      <BookReader
        handle={dono.handle ?? handle}
        slug={livro.slug}
        versao={versaoDosArquivos(livro)}
        totalDePaginasConhecido={livro.total_paginas}
      />
    </div>
  )
}
