// /admin/livros — lista de todos os livros, publicados e rascunho (spec seção 10,
// critério 8.2). É tela de leitura: nada é editado aqui, só navegação para criar
// ou editar (prompt de design).
//
// A leitura é feita direto no componente de servidor, sem passar por rota de API:
// continua sendo servidor, a credencial não vai ao navegador (princípio 0.3), e o
// layout já garantiu que quem chegou aqui é admin. Sem cache de propósito — o
// admin precisa ver o que acabou de salvar (regra 11.7 vale para as telas públicas).
import type { Metadata } from 'next'
import Link from 'next/link'
import { BookCover } from '@/components/admin/BookCover'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { ordenarPorCriadoEmDesc } from '@/lib/books'
import { COPY } from '@/lib/copy'
import { formatarData } from '@/lib/format'
import { readAllBooks } from '@/lib/google/sheets'

export const metadata: Metadata = { title: 'Livros' }
export const dynamic = 'force-dynamic'

export default async function ListaDeLivrosPage() {
  const livros = ordenarPorCriadoEmDesc(await readAllBooks())

  return (
    <>
      <div className="mb-[26px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-[5px] text-[25px] font-semibold tracking-[-0.02em]">Livros</h1>
          <p className="text-[13px] text-tinta-apagada">
            {livros.length === 0
              ? 'Nenhum livro cadastrado'
              : `${livros.length} ${livros.length === 1 ? 'livro' : 'livros'} cadastrados`}
          </p>
        </div>
        <Link
          href="/admin/livros/novo"
          className="rounded-[10px] bg-destaque px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-destaque-escuro"
        >
          Novo livro
        </Link>
      </div>

      {livros.length === 0 ? (
        // Estado vazio com o botão em destaque, exatamente como pede o critério 8.2.
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-hairline-tracejada bg-superficie-fraca px-6 py-[74px]">
          <div className="h-[58px] w-11 rounded-[5px] border border-hairline-tracejada bg-superficie" />
          <p className="text-[15px] font-medium text-tinta-media">{COPY.listaAdminVazia}</p>
          <Link
            href="/admin/livros/novo"
            className="rounded-[10px] bg-destaque px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-destaque-escuro"
          >
            Novo livro
          </Link>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[14px] border border-hairline bg-superficie">
          {livros.map((livro) => (
            <li
              key={livro.id}
              className="flex items-center gap-4 border-b border-preenchimento-fraco px-[18px] py-4 last:border-b-0"
            >
              <BookCover
                slug={livro.slug}
                titulo={livro.titulo}
                temCapa={Boolean(livro.capa_drive_id)}
                className="h-[52px] w-[38px]"
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/livros/${livro.id}`}
                  className="block truncate text-[14px] font-medium text-tinta hover:text-destaque"
                >
                  {livro.titulo}
                </Link>
                <p className="truncate text-[12px] text-tinta-apagada">
                  /l/{livro.slug}
                  {livro.total_paginas ? ` · ${livro.total_paginas} páginas` : ''}
                </p>
              </div>

              <StatusBadge publicado={livro.publicado} />

              <div className="hidden w-[130px] shrink-0 text-right text-[12px] text-tinta-apagada sm:block">
                {formatarData(livro.atualizado_em)}
              </div>

              <div className="w-[128px] shrink-0 text-right">
                {/* O link para a página pública só aparece quando o livro está
                    publicado — rascunho não tem página pública (critério 8.2). */}
                {livro.publicado === 'sim' ? (
                  <Link
                    href={`/l/${livro.slug}`}
                    target="_blank"
                    className="text-[12px] font-medium text-destaque hover:underline"
                  >
                    Ver página pública
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
