// /admin/livros/[id] — edição de um livro (spec seção 10, épico 8.2).
// Lê a linha direto da planilha, sem cache: o admin precisa ver o estado atual,
// inclusive o que acabou de salvar (regra 11.7 vale para as telas públicas).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EditBookForm } from '@/components/admin/EditBookForm'
import { findBookById } from '@/lib/google/sheets'

export const metadata: Metadata = { title: 'Editar livro' }
export const dynamic = 'force-dynamic'

export default async function EditarLivroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const livro = await findBookById(id)
  if (!livro) notFound()

  return (
    <>
      <div className="mb-[26px]">
        <Link
          href="/admin/livros"
          className="mb-3 inline-block text-[13px] text-tinta-apagada hover:text-destaque"
        >
          ← Livros
        </Link>
        <h1 className="text-[25px] font-semibold tracking-[-0.02em]">{livro.titulo}</h1>
        <p className="mt-1 text-[13px] text-tinta-apagada">/l/{livro.slug}</p>
      </div>
      <EditBookForm livro={livro} />
    </>
  )
}
