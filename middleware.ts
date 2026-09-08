// Bloqueio das rotas do painel (spec critério 8.1): qualquer /admin/* sem sessão
// válida é redirecionado para /admin/login antes de a página renderizar.
//
// Esta é a primeira barreira, não a única: as rotas de API têm a sua própria
// guarda (`requireAdmin()`), porque sem banco relacional não há RLS por baixo
// para segurar o que passar daqui (seções 6 e 20).
import { NextResponse } from 'next/server'
import { auth } from '@/lib/google/auth'
import { isAdminEmail } from '@/lib/google/config'

export default auth((request) => {
  const { pathname } = request.nextUrl

  // A própria tela de login precisa ficar aberta, senão vira um laço.
  if (pathname.startsWith('/admin/login')) return NextResponse.next()

  if (!isAdminEmail(request.auth?.user?.email)) {
    return NextResponse.redirect(new URL('/admin/login', request.nextUrl))
  }

  return NextResponse.next()
})

// Só as rotas do painel passam por aqui — catálogo e leitor são públicos
// e não devem pagar o custo do middleware (princípio 0.2).
export const config = {
  matcher: ['/admin/:path*'],
}
