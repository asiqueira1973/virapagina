// / — catálogo público (spec seção 10, épico 8.5).
//
// Lista só os livros publicados, do mais recente para o mais antigo. É a mesma
// tela para visitante e admin: o catálogo nunca mostra rascunho, nem para quem o
// criou (regra 11.4 e prompt de design). Página consumer, sem menu lateral.
import type { Metadata } from 'next'
import Link from 'next/link'
import { BookCover } from '@/components/admin/BookCover'
import { ordenarPorCriadoEmDesc } from '@/lib/books'
import { COPY } from '@/lib/copy'
import { readAllBooksCached } from '@/lib/google/sheets'

export const metadata: Metadata = {
  // `absolute` evita o sufixo do template do layout raiz, que deixaria a aba
  // do catálogo como "Virapágina — Virapágina".
  title: { absolute: 'Virapágina — Livros e revistas para folhear' },
  description: 'Livros e revistas digitais para folhear no navegador.',
}

// Cache de 60 segundos, invalidado na hora por qualquer ação do admin (regra 11.7).
export const revalidate = 60

export default async function CatalogoPage() {
  // Uma falha de integração com o Google não pode deixar a home quebrada, mas
  // também não pode virar "nenhum livro publicado ainda": são coisas diferentes e
  // a mensagem errada mandaria o Alexandre procurar o problema no lugar errado
  // (fluxo de exceção da seção 9).
  let publicados: Awaited<ReturnType<typeof readAllBooksCached>> = []
  let falhouAIntegracao = false
  try {
    publicados = ordenarPorCriadoEmDesc(
      (await readAllBooksCached()).filter((livro) => livro.publicado === 'sim'),
    )
  } catch (erro) {
    console.error('Falha ao ler o catálogo na planilha:', erro)
    falhouAIntegracao = true
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-10 sm:mb-14">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-[4px] bg-destaque" aria-hidden="true" />
          <span className="text-[14px] font-semibold tracking-[-0.01em]">Virapágina</span>
        </div>
        <h1 className="font-display text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[44px]">
          Livros e revistas para folhear
        </h1>
      </header>

      {falhouAIntegracao ? (
        <p className="text-[15px] text-tinta-apagada">{COPY.erroGenerico}</p>
      ) : publicados.length === 0 ? (
        // Estado vazio simples, sem tom de erro (critério 8.5).
        <p className="text-[15px] text-tinta-apagada">{COPY.catalogoVazio}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
          {publicados.map((livro) => (
            <li key={livro.id}>
              <Link href={`/l/${livro.slug}`} className="group block">
                <BookCover
                  slug={livro.slug}
                  titulo={livro.titulo}
                  temCapa={Boolean(livro.capa_drive_id)}
                  className="mb-3.5 aspect-[1/1.414] w-full shadow-[0_2px_10px_rgba(23,24,26,0.10)] transition-shadow group-hover:shadow-[0_6px_22px_rgba(23,24,26,0.16)]"
                />
                <h2 className="text-[14px] font-medium leading-snug text-tinta group-hover:text-destaque">
                  {livro.titulo}
                </h2>
                {livro.subtitulo ? (
                  <p className="mt-0.5 text-[13px] leading-snug text-tinta-suave">
                    {livro.subtitulo}
                  </p>
                ) : null}
                <p className="mt-1 text-[12px] text-tinta-apagada">{livro.autor}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
