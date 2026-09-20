'use client'

// Menu lateral do painel, no padrão App Store Connect exigido pela seção 16:
// grupo em negrito escuro, itens indentados sem marcador, traço separando, um
// item ativo por vez em pílula neutra, e rodapé com o e-mail e "Sair".
//
// A aparência vem do Cartão de Visita (seção 16): menu cinza contra conteúdo
// branco, item de 14px, ativo em pílula #ECECEC com texto semibold. O que NÃO
// veio de lá é a estrutura — aquele produto tem lista plana com ícones, e aqui
// os grupos continuam, porque é por eles que o admin da plataforma tem caminho
// de ida e de volta entre os dois painéis.
//
// Serve os dois painéis — o do autor e o da plataforma —, que têm a mesma forma.
// Quem monta a lista de grupos é `lib/menu.ts`, no servidor.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { GrupoDeMenu } from '@/lib/menu'

const traco = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function Sidebar({
  grupos,
  email,
  acaoSair,
}: {
  grupos: GrupoDeMenu[]
  email: string
  acaoSair: () => Promise<void>
}) {
  const caminho = usePathname()

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-traco bg-superficie-2 px-3 py-[18px]">
      <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
        <span className="inline-block h-5.5 w-5.5 rounded-md bg-tinta" aria-hidden="true" />
        <span className="text-[15px] font-bold tracking-[-0.01em] text-tinta">Virapágina</span>
      </Link>

      <nav className="flex flex-col" aria-label="Seções do painel">
        {grupos.map((grupo, indice) => (
          <div
            key={grupo.titulo}
            // Traço separando os grupos, nunca antes do primeiro (seção 16).
            className={
              indice === 0
                ? 'flex flex-col gap-0.5'
                : 'mt-3.5 flex flex-col gap-0.5 border-t border-traco pt-3.5'
            }
          >
            <div className="px-2.5 pt-1.5 pb-1 text-[13px] font-bold text-tinta">
              {grupo.titulo}
            </div>
            {grupo.itens.map((item) => {
              const ativo = caminho.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`flex min-h-9.5 items-center rounded-[9px] pr-2.5 pl-4.5 text-sm transition-colors ${
                    ativo
                      ? 'bg-ativo font-semibold text-tinta'
                      : 'font-medium text-tinta-media hover:bg-ativo/50'
                  }`}
                >
                  {item.rotulo}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      <form
        action={acaoSair}
        className="flex items-center gap-2.5 border-t border-traco px-2 pt-3.5"
      >
        <span
          aria-hidden="true"
          className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full bg-tinta text-[10px] font-bold text-white"
        >
          {iniciais(email)}
        </span>
        <span className="grow truncate text-[12px] font-semibold text-tinta" title={email}>
          {email}
        </span>
        <button
          type="submit"
          aria-label="Sair"
          title="Sair"
          className="cursor-pointer text-tinta-apagada transition-colors hover:text-tinta"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" {...traco}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </form>
    </aside>
  )
}

// Duas letras para o avatar, tiradas do e-mail — é o que o painel conhece de
// quem está logado. `ana.paula@x.com` dá "AP"; `ana@x.com` dá "AN".
function iniciais(email: string): string {
  const local = email.split('@')[0] ?? ''
  const partes = local.split(/[.\-_+]+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  return (local.slice(0, 2) || '?').toUpperCase()
}
