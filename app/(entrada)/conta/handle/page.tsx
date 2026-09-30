// /conta/handle — escolha do endereço público, no primeiro acesso
// (spec seção 10, épico 8.1).
//
// Tela de passo único, sem menu lateral: é o único momento em que o autor não
// tem para onde ir. Quem já tem handle é mandado para o painel — a tela não
// serve para trocar (regra 11.10).
//
// **Mora num grupo de rota, fora de `app/conta/`, e isso não é organização: é
// correção de um laço.** O layout de `app/conta/` manda para cá quem ainda não
// tem handle — e, quando esta página vivia lá dentro, ele fazia isso também
// para quem já estava aqui. O navegador seguia o redirecionamento para a mesma
// URL, sem fim: ERR_TOO_MANY_REDIRECTS no primeiro login de toda conta nova.
// Grupo de rota não muda a URL, então o endereço continua `/conta/handle`; muda
// só de quem esta página herda layout. Não a mova de volta.
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HandleForm } from '@/components/account/HandleForm'
import { auth } from '@/lib/auth'
import { garantirUsuario, sugerirHandleLivre } from '@/lib/firebase/firestore'
import { dominioDoSite } from '@/lib/site'
import { slugify } from '@/lib/slug'

export const metadata: Metadata = { title: 'Escolha seu endereço' }
export const dynamic = 'force-dynamic'

export default async function HandlePage() {
  const sessao = await auth()
  if (!sessao?.user?.id || !sessao.user.email) redirect('/entrar')

  const usuario = await garantirUsuario({
    id: sessao.user.id,
    email: sessao.user.email,
    nome: sessao.user.name ?? null,
  })
  if (usuario.handle) redirect('/conta/livros')

  // Sugestão a partir do nome do Google, ou do trecho antes do @ no e-mail —
  // **já conferida contra os endereços tomados**.
  //
  // Sem `sugerirHandleLivre`, a tela abria no vermelho para quem tem nome
  // comum: o campo vinha preenchido pelo próprio produto, a checagem dizia
  // "esse endereço já está em uso" e o botão nascia desabilitado, tudo antes de
  // a pessoa digitar qualquer coisa. Foi assim que a App Review registrou um
  // erro no primeiro acesso — todo revisor da Apple se chama "John Apple", e o
  // segundo a testar encontrava `john-apple` tomado pelo primeiro.
  const base = usuario.nome ?? usuario.email.split('@')[0]
  const pedida = slugify(base).slice(0, 30)
  const sugestao = pedida.length >= 3 ? await sugerirHandleLivre(pedida) : ''

  return (
    <main className="flex min-h-dvh items-center justify-center bg-superficie px-6 py-16">
      <div className="w-full max-w-[460px]">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-[4px] bg-tinta" aria-hidden="true" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-tinta">Virapágina</span>
        </Link>

        <div className="rounded-2xl border border-traco bg-superficie p-7">
          <h1 className="mb-1.5 text-[21px] font-bold tracking-tight">
            Escolha seu endereço
          </h1>
          <p className="mb-6 text-[13px] leading-relaxed text-tinta-fraca">
            É por ele que as pessoas vão chegar nos seus livros. Escolha com calma: ele não pode
            ser trocado depois.
          </p>
          <HandleForm
            sugestaoInicial={sugestao}
            dominio={dominioDoSite()}
          />
        </div>
      </div>
    </main>
  )
}
