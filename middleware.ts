// Bloqueio das rotas do painel do autor (spec critério 8.1): qualquer /conta/*
// sem sessão é redirecionado para /entrar antes de a página renderizar.
//
// Esta é a primeira barreira, não a única: as rotas de API têm as suas próprias
// guardas (`lib/guards.ts`), porque sem banco relacional não há RLS por baixo
// para segurar o que passar daqui.
//
// As rotas /admin/* não passam por aqui de propósito. Elas devolvem 404 para
// quem não é admin da plataforma — inclusive para quem não está logado — e quem
// faz isso é o layout, com `notFound()`. Redirecionar para o login já confirmaria
// que a rota existe (critério 8.7).
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export default auth((request) => {
  if (!request.auth?.user?.email) {
    const destino = new URL('/entrar', request.nextUrl)
    // Guarda para onde a pessoa queria ir, para devolvê-la depois do login.
    destino.searchParams.set('voltar', request.nextUrl.pathname)
    return NextResponse.redirect(destino)
  }
  return NextResponse.next()
})

// Só o painel do autor passa por aqui — a home, a vitrine e o leitor são
// públicos e não devem pagar o custo do middleware (princípio 0.2).
export const config = {
  matcher: ['/conta/:path*'],
}
