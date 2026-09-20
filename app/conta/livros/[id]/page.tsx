// /conta/livros/[id] — edição de um livro (spec seção 10, épico 8.2).
//
// Livro de outra conta devolve 404, não 403: responder "existe, mas não é seu"
// confirmaria a existência de um rascunho alheio (seção 6). É a mesma regra da
// guarda `requireDonoDoLivro`, aplicada aqui na camada de tela.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { EditBookForm } from '@/components/account/EditBookForm'
import { auth } from '@/lib/auth'
import { buscarLivroPorId, garantirUsuario } from '@/lib/firebase/firestore'

export const metadata: Metadata = { title: 'Editar livro' }
export const dynamic = 'force-dynamic'

export default async function EditarLivroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await auth()
  if (!sessao?.user?.id || !sessao.user.email) redirect('/entrar')

  const usuario = await garantirUsuario({
    id: sessao.user.id,
    email: sessao.user.email,
    nome: sessao.user.name ?? null,
  })
  if (!usuario.handle) redirect('/conta/handle')

  const { id } = await params
  const livro = await buscarLivroPorId(id)
  // Livro inexistente e livro de outra conta dão exatamente o mesmo 404.
  if (!livro || livro.dono_id !== usuario.id) notFound()

  return (
    <>
      <div className="mb-[26px]">
        <Link
          href="/conta/livros"
          className="mb-3 inline-block text-[13px] text-tinta-apagada hover:text-tinta"
        >
          ← Livros
        </Link>
        <h1 className="text-[26px] font-bold tracking-tight">{livro.titulo}</h1>
        <p className="mt-1 text-[13px] text-tinta-apagada">
          /{usuario.handle}/{livro.slug}
        </p>
      </div>
      <EditBookForm livro={livro} handle={usuario.handle} />
    </>
  )
}
