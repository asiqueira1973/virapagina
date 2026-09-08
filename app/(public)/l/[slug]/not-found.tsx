// 404 do leitor público (critério 8.3): slug inexistente ou livro despublicado
// para quem não é admin. A copy é a da seção 14–15, com link para o catálogo.
import Link from 'next/link'
import { COPY } from '@/lib/copy'

export default function LivroNaoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-tela px-6 text-center">
      <p className="text-[17px] font-medium text-tinta">{COPY.livroIndisponivel}</p>
      <Link
        href="/"
        className="rounded-[10px] bg-destaque px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-destaque-escuro"
      >
        Ver o catálogo
      </Link>
    </main>
  )
}
