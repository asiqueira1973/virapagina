'use client'

// Menu lateral do painel, no padrão App Store Connect exigido pela seção 16:
// grupo em negrito escuro, itens indentados sem marcador, hairline separando,
// um item ativo por vez na cor de destaque, e rodapé com o e-mail e "Sair".
// No MVP existe um grupo só, "Livros" — não há outras seções ainda (seção 16).
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Itens do grupo "Livros". A lista de livros fica ativa também nas telas de
// criação e edição, que são filhas dela no fluxo (seção 9).
const ITENS = [{ href: '/admin/livros', rotulo: 'Todos os livros' }]

export function AdminSidebar({
  email,
  acaoSair,
}: {
  email: string
  acaoSair: () => Promise<void>
}) {
  const caminho = usePathname()

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-hairline bg-superficie py-5">
      <div className="mb-6 flex items-center gap-2 px-[18px]">
        <span className="inline-block h-4 w-4 rounded-[4px] bg-destaque" aria-hidden="true" />
        <span className="text-[14px] font-semibold tracking-[-0.01em]">Virapágina</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5" aria-label="Seções do painel">
        <div className="px-2 pt-2 pb-1 text-[13px] font-bold text-tinta">Livros</div>
        {ITENS.map((item) => {
          const ativo = caminho.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? 'page' : undefined}
              className={`rounded-lg py-[7px] pr-2.5 pl-5 text-[13px] transition-colors ${
                ativo
                  ? 'bg-destaque-fraco font-medium text-destaque'
                  : 'text-tinta-suave hover:bg-preenchimento-fraco'
              }`}
            >
              {item.rotulo}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />

      <div className="mx-[18px] flex flex-col gap-2 border-t border-hairline pt-3.5">
        <div className="truncate text-[12px] text-tinta-apagada" title={email}>
          {email}
        </div>
        <form action={acaoSair}>
          <button
            type="submit"
            className="cursor-pointer rounded-lg border border-hairline-forte bg-superficie px-[11px] py-[5px] text-[12px] font-medium text-tinta-media transition-colors hover:bg-tela"
          >
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
