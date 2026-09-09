// Casca do painel do autor: menu lateral fixo + área de conteúdo (spec seção 16).
//
// O middleware já barrou quem não tem sessão, mas a checagem é refeita aqui: é o
// layout que decide o que renderizar, e confiar só no middleware seria a mesma
// armadilha de confiar só no frontend (seção 6).
//
// É também aqui que a conta nasce e que a regra 11.13 é reaplicada — toda tela
// do painel passa por este ponto.
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/account/Sidebar'
import { auth, signOut } from '@/lib/auth'
import { garantirUsuario } from '@/lib/firebase/firestore'

// No MVP o grupo é um só: "Livros" (seção 16).
const ITENS = [{ href: '/conta/livros', rotulo: 'Meus livros' }]

export default async function ContaLayout({ children }: { children: React.ReactNode }) {
  const sessao = await auth()
  if (!sessao?.user?.id || !sessao.user.email) redirect('/entrar')

  const usuario = await garantirUsuario({
    id: sessao.user.id,
    email: sessao.user.email,
    nome: sessao.user.name ?? null,
  })

  // Sem handle não existe URL pública, logo não existe produto: a escolha vem
  // antes de qualquer outra tela e não é pulável (critério 8.1).
  //
  // O destino deste redirecionamento vive FORA de `app/conta/`, num grupo de
  // rota, justamente para não passar por este layout — senão ele mandaria para
  // cá quem já está lá, e o navegador ficaria em laço. Ver o comentário em
  // `app/(entrada)/conta/handle/page.tsx`.
  if (!usuario.handle) redirect('/conta/handle')

  // "Sair" encerra a sessão e volta para a home pública (critério 8.1).
  async function sair() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    <div className="flex min-h-screen bg-superficie">
      <Sidebar grupo="Livros" itens={ITENS} email={usuario.email} acaoSair={sair} />
      <main className="min-w-0 flex-1 bg-tela px-10 pt-[34px] pb-15">
        <div className="max-w-[1180px]">{children}</div>
      </main>
    </div>
  )
}
