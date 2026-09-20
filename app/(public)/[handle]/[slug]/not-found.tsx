// 404 do leitor público (critério 8.3): slug inexistente, ou rascunho pedido por
// quem não é o dono. Copy da seção 15.
import Link from 'next/link'
import { COPY } from '@/lib/copy'

export default function LivroNaoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-superficie px-6 text-center">
      <p className="text-[17px] font-medium text-tinta">{COPY.livroIndisponivel}</p>
      <Link
        href="/"
        className="rounded-full bg-tinta px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-tinta-media"
      >
        Ir para a home
      </Link>
    </main>
  )
}
