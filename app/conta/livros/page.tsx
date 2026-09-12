// /conta/livros — lista dos livros do autor (spec seção 10, critério 8.2).
//
// Mostra **só os livros do próprio dono**, rascunho e publicado, com o uso
// contra o limite do plano. É tela de leitura: nada é editado aqui.
//
// A leitura é feita direto no componente de servidor, sem passar por rota de
// API: continua sendo servidor, a credencial não vai ao navegador (princípio
// 0.3), e o layout já garantiu quem é. Sem cache — o autor precisa ver o que
// acabou de salvar (a regra 11.7 vale para as telas públicas).
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookCover } from '@/components/reader/BookCover'
import { StatusBadge } from '@/components/account/StatusBadge'
import { ordenarPorCriadoEmDesc } from '@/lib/books'
import { versaoDosArquivos } from '@/lib/cache'
import { COPY, emailDeContato } from '@/lib/copy'
import { formatarData } from '@/lib/format'
import { auth } from '@/lib/auth'
import { garantirUsuario, listarLivrosDoDono } from '@/lib/firebase/firestore'
import { limiteDeLivros, temVagaParaNovoLivro } from '@/lib/planos'

export const metadata: Metadata = { title: 'Meus livros' }
export const dynamic = 'force-dynamic'

export default async function MeusLivrosPage() {
  const sessao = await auth()
  if (!sessao?.user?.id || !sessao.user.email) redirect('/entrar')

  const usuario = await garantirUsuario({
    id: sessao.user.id,
    email: sessao.user.email,
    nome: sessao.user.name ?? null,
  })
  const livros = ordenarPorCriadoEmDesc(await listarLivrosDoDono(usuario.id))

  const limite = limiteDeLivros(usuario.plano)
  const temVaga = temVagaParaNovoLivro(usuario.plano, livros.length)

  return (
    <>
      <div className="mb-[26px] flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="mb-[5px] text-[25px] font-semibold tracking-[-0.02em]">Livros</h1>
          <p className="text-[13px] text-tinta-apagada">
            {livros.length === 0
              ? 'Nenhum livro cadastrado'
              : limite === null
                ? `${livros.length} ${livros.length === 1 ? 'livro' : 'livros'}`
                : `${livros.length} de ${limite} livros`}
          </p>
        </div>

        {temVaga ? (
          <Link
            href="/conta/livros/novo"
            className="rounded-[10px] bg-destaque px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-destaque-escuro"
          >
            Novo livro
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="cursor-not-allowed rounded-[10px] bg-tinta-apagada px-4 py-2.5 text-[13px] font-semibold text-white opacity-60"
          >
            Novo livro
          </span>
        )}
      </div>

      {/* Limite atingido: bloqueia publicar o próximo, nunca tira nada do ar
          (princípio 0.5). Enquanto não há cobrança, quem libera mais espaço é o
          dono da plataforma — daí o contato humano (critério 8.2). */}
      {!temVaga && limite !== null ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-perigo-borda bg-perigo-fundo px-[18px] py-3.5">
          <div className="flex items-center gap-3">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-perigo"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16.5h.01" />
            </svg>
            <p className="text-[13px] text-perigo">{COPY.limiteAtingido(limite)}</p>
          </div>
          <a
            href={`mailto:${emailDeContato()}?subject=${encodeURIComponent('Preciso de mais livros no Virapágina')}`}
            className="shrink-0 rounded-[10px] border border-perigo-borda bg-superficie px-3.5 py-2 text-[13px] font-semibold text-perigo transition-colors hover:bg-[#fbe6e6]"
          >
            Falar com a gente
          </a>
        </div>
      ) : null}

      {livros.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-hairline-tracejada bg-superficie-fraca px-6 py-[74px]">
          <div className="h-[58px] w-11 rounded-[5px] border border-hairline-tracejada bg-superficie" />
          <p className="text-[15px] font-medium text-tinta-media">{COPY.listaVazia}</p>
          <Link
            href="/conta/livros/novo"
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
                handle={usuario.handle ?? ''}
                slug={livro.slug}
                titulo={livro.titulo}
                temCapa={Boolean(livro.capa_caminho)}
                versao={versaoDosArquivos(livro)}
                className="h-[52px] w-[38px]"
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/conta/livros/${livro.id}`}
                  className="block truncate text-[14px] font-medium text-tinta hover:text-destaque"
                >
                  {livro.titulo}
                </Link>
                <p className="truncate text-[12px] text-tinta-apagada">
                  /{usuario.handle}/{livro.slug}
                  {livro.total_paginas ? ` · ${livro.total_paginas} páginas` : ''}
                </p>
              </div>

              <StatusBadge publicado={livro.publicado} />

              <div className="hidden w-[130px] shrink-0 text-right text-[12px] text-tinta-apagada sm:block">
                {formatarData(livro.atualizado_em)}
              </div>

              <div className="w-[128px] shrink-0 text-right">
                {/* O link público só aparece quando o livro está publicado —
                    rascunho não tem página pública (critério 8.2). */}
                {livro.publicado ? (
                  <Link
                    href={`/${usuario.handle}/${livro.slug}`}
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
