// Casca das telas do painel: menu lateral fixo + área de conteúdo (seção 16).
// A tela de login fica fora deste layout de propósito — quem ainda não entrou
// não vê navegação (prompt de design).
//
// O middleware já barrou quem não tem sessão, mas a checagem é repetida aqui:
// é o layout que decide o que renderizar, e confiar só no middleware seria a
// mesma armadilha de confiar só no frontend (seção 6).
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { auth, signOut } from '@/lib/google/auth'
import { isAdminEmail } from '@/lib/google/config'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await auth()
  const email = sessao?.user?.email ?? ''
  if (!isAdminEmail(email)) redirect('/admin/login')

  // "Sair" encerra a sessão do NextAuth e volta para a home pública (critério 8.1).
  async function sair() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    <div className="flex min-h-screen bg-superficie">
      <AdminSidebar email={email} acaoSair={sair} />
      <main className="min-w-0 flex-1 bg-tela px-10 pt-[34px] pb-15">
        <div className="max-w-[1180px]">{children}</div>
      </main>
    </div>
  )
}
