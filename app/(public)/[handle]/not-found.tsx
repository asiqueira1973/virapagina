// 404 da vitrine (critério 8.5): handle que não existe. Copy da seção 15.
import Link from 'next/link'
import { COPY } from '@/lib/copy'

export default function AutorNaoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-tela px-6 text-center">
      <p className="text-[17px] font-medium text-tinta">{COPY.autorInexistente}</p>
      <Link
        href="/"
        className="rounded-[10px] bg-acao px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-acao-clara"
      >
        Ir para a home
      </Link>
    </main>
  )
}
