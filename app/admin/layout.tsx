// Casca do painel da plataforma (spec seção 16, épico 8.7).
//
// Quem não é admin da plataforma recebe **404**, não uma tela de acesso negado:
// uma tela de acesso negado confirmaria que a rota existe (critério 8.7). Vale
// também para quem não está logado — por isso o middleware não cobre /admin.
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/account/Sidebar'
import { isAdminEmail } from '@/lib/admins'
import { auth, signOut } from '@/lib/auth'
import { gruposDoPainel } from '@/lib/menu'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await auth()
  const email = sessao?.user?.email ?? ''
  if (!isAdminEmail(email)) notFound()

  async function sair() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    <div className="flex min-h-screen bg-superficie">
      <Sidebar grupos={gruposDoPainel(email)} email={email} acaoSair={sair} />
      <main className="min-w-0 flex-1 bg-tela px-10 pt-[34px] pb-15">
        <div className="max-w-[1180px]">{children}</div>
      </main>
    </div>
  )
}
