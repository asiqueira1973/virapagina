// Cabeçalho e rodapé das páginas públicas (spec seção 16): páginas consumer, sem
// menu lateral. O rodapé carrega os links obrigatórios da seção 20 — termos,
// privacidade e o canal de denúncia.
import Link from 'next/link'
import { RESPONSAVEL, emailDeContato } from '@/lib/copy'

export function CabecalhoPublico() {
  return (
    <header className="flex items-center justify-between border-b border-hairline bg-superficie px-6 py-[22px] sm:px-12">
      <Link href="/" className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded-[4px] bg-destaque" aria-hidden="true" />
        <span className="text-[14px] font-semibold tracking-[-0.01em] text-tinta">Virapágina</span>
      </Link>
      <Link href="/entrar" className="text-[13px] font-medium text-tinta-media hover:text-destaque">
        Entrar
      </Link>
    </header>
  )
}

export function RodapePublico() {
  return (
    <footer className="border-t border-hairline bg-superficie px-6 py-[26px] sm:px-12">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 text-[12px] text-tinta-apagada">
        <span>
          Virapágina — {RESPONSAVEL.nome}
        </span>
        <span className="flex flex-wrap gap-5">
          <Link href="/termos" className="text-tinta-apagada hover:text-destaque">
            Termos
          </Link>
          <Link href="/privacidade" className="text-tinta-apagada hover:text-destaque">
            Privacidade
          </Link>
          <a href={`mailto:${emailDeContato()}`} className="text-tinta-apagada hover:text-destaque">
            {emailDeContato()}
          </a>
        </span>
      </div>
    </footer>
  )
}
