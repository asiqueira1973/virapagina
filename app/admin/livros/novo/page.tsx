// /admin/livros/novo — formulário de criação de livro (spec seção 10, épico 8.2).
// A tela é fina de propósito: toda a lógica de upload e salvamento vive no
// componente de cliente, porque depende do PDF.js rodando no navegador
// (princípio 0.1 e regra 11.1).
import type { Metadata } from 'next'
import Link from 'next/link'
import { NewBookForm } from '@/components/admin/NewBookForm'

export const metadata: Metadata = { title: 'Novo livro' }

export default function NovoLivroPage() {
  return (
    <>
      <div className="mb-[26px]">
        <Link
          href="/admin/livros"
          className="mb-3 inline-block text-[13px] text-tinta-apagada hover:text-destaque"
        >
          ← Livros
        </Link>
        <h1 className="text-[25px] font-semibold tracking-[-0.02em]">Novo livro</h1>
      </div>
      <NewBookForm />
    </>
  )
}
