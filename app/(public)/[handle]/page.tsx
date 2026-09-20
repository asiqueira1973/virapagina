// /<handle> — vitrine pública de um autor (spec seção 10, épico 8.5).
//
// Lista só os livros publicados daquele dono, do mais recente ao mais antigo.
// Rascunho não aparece — nem para o próprio dono: a vitrine é a página pública,
// e conferir rascunho é papel da prévia (critério 8.5).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CabecalhoPublico, RodapePublico } from '@/components/marketing/Chrome'
import { BookCover } from '@/components/reader/BookCover'
import { ordenarPorCriadoEmDesc } from '@/lib/books'
import { versaoDosArquivos } from '@/lib/cache'
import { COPY } from '@/lib/copy'
import { dominioDoSite } from '@/lib/site'
import { buscarUsuarioPorHandle, listarLivrosDoDono } from '@/lib/firebase/firestore'
import type { Livro, Usuario } from '@/types/livro'

// Cache de 60 segundos, como toda leitura que alimenta tela pública (regra 11.7).
export const revalidate = 60

// Três desfechos, de propósito: achou, não existe, e falha de integração. Sem
// essa separação, uma queda do Firestore apareceria como "esse endereço não
// existe" — mentira que manda procurar o problema no lugar errado (seção 9).
type Resultado =
  | { estado: 'ok'; autor: Usuario; livros: Livro[] }
  | { estado: 'ausente' }
  | { estado: 'falha' }

async function buscarVitrine(handle: string): Promise<Resultado> {
  try {
    const autor = await buscarUsuarioPorHandle(handle.toLowerCase())
    if (!autor) return { estado: 'ausente' }
    const livros = ordenarPorCriadoEmDesc(
      (await listarLivrosDoDono(autor.id)).filter((livro) => livro.publicado),
    )
    return { estado: 'ok', autor, livros }
  } catch (erro) {
    console.error(`Falha ao ler a vitrine de ${handle}:`, erro)
    return { estado: 'falha' }
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const resultado = await buscarVitrine(handle)
  if (resultado.estado !== 'ok') return { title: 'Endereço não encontrado' }
  const nome = resultado.autor.nome ?? resultado.autor.handle ?? handle
  return {
    title: nome,
    description: `Livros e revistas publicados por ${nome} no Virapágina.`,
    openGraph: { title: nome, url: `/${handle}` },
  }
}

export default async function VitrinePage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const resultado = await buscarVitrine(handle)
  if (resultado.estado === 'ausente') notFound()

  return (
    <div className="flex min-h-dvh flex-col bg-superficie">
      <CabecalhoPublico />

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-6 py-14 sm:px-12">
        {resultado.estado === 'falha' ? (
          <p className="text-[15px] text-tinta-apagada">{COPY.erroGenerico}</p>
        ) : (
          <>
            <header className="mb-11">
              <h1 className="mb-2 font-display text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
                {resultado.autor.nome ?? `/${resultado.autor.handle}`}
              </h1>
              <p className="font-mono text-[13px] text-tinta-apagada">
                {dominioDoSite()}/{resultado.autor.handle}
              </p>
            </header>

            {resultado.livros.length === 0 ? (
              <p className="text-[15px] text-tinta-apagada">{COPY.vitrineVazia}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
                {resultado.livros.map((livro) => (
                  <li key={livro.id}>
                    <Link href={`/${resultado.autor.handle}/${livro.slug}`} className="group block">
                      <BookCover
                        handle={resultado.autor.handle ?? ''}
                        slug={livro.slug}
                        titulo={livro.titulo}
                        temCapa={Boolean(livro.capa_caminho)}
                        versao={versaoDosArquivos(livro)}
                        className="mb-3.5 aspect-[1/1.414] w-full shadow-[0_2px_10px_rgba(13,13,13,0.10)] transition-shadow group-hover:shadow-[0_6px_22px_rgba(13,13,13,0.16)]"
                      />
                      <h2 className="text-[14px] leading-snug font-medium text-tinta group-hover:underline">
                        {livro.titulo}
                      </h2>
                      {livro.subtitulo ? (
                        <p className="mt-0.5 text-[13px] leading-snug text-tinta-fraca">
                          {livro.subtitulo}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[12px] text-tinta-apagada">{livro.autor}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <RodapePublico />
    </div>
  )
}
