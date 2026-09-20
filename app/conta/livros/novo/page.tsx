// /conta/livros/novo — criação de livro (spec seção 10, épico 8.2).
//
// A tela é fina de propósito: toda a lógica de upload e salvamento vive no
// componente de cliente, porque depende do PDF.js rodando no navegador
// (princípio 0.1 e regra 11.1).
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { NewBookForm } from '@/components/account/NewBookForm'
import { auth } from '@/lib/auth'
import { garantirUsuario } from '@/lib/firebase/firestore'

export const metadata: Metadata = { title: 'Novo livro' }
export const dynamic = 'force-dynamic'

export default async function NovoLivroPage() {
  const sessao = await auth()
  if (!sessao?.user?.id || !sessao.user.email) redirect('/entrar')

  const usuario = await garantirUsuario({
    id: sessao.user.id,
    email: sessao.user.email,
    nome: sessao.user.name ?? null,
  })
  if (!usuario.handle) redirect('/conta/handle')

  return (
    <>
      <div className="mb-[26px]">
        <Link
          href="/conta/livros"
          className="mb-3 inline-block text-[13px] text-tinta-apagada hover:text-tinta"
        >
          ← Livros
        </Link>
        <h1 className="text-[26px] font-bold tracking-tight">Novo livro</h1>
      </div>
      <NewBookForm handle={usuario.handle} />
    </>
  )
}
