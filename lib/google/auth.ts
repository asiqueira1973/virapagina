// Autenticação do admin (spec seções 5, 6 e épico 8.1) e a guarda `requireAdmin()`
// que toda rota /api/admin/* chama como primeira linha.
//
// Não existe banco relacional aqui, logo não existe RLS como segunda camada de
// defesa: a checagem feita neste arquivo é a única coisa entre um visitante
// qualquer e os rascunhos do Alexandre (seções 20 e 23). Nada de confiar em
// checagem feita só no frontend.
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { NextResponse } from 'next/server'
import { isAdminEmail } from './config'

// Configuração do NextAuth/Auth.js: login só com Google, sessão em JWT (não há
// banco onde guardar sessão) e validade de 30 dias com renovação silenciosa,
// conforme a seção 6.
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/admin/login', error: '/admin/login' },
  providers: [
    Google({
      // Os nomes das variáveis são os da seção 18, então são passados na mão em
      // vez de deixar o Auth.js adivinhar pelos nomes padrão dele.
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Qualquer pessoa pode tentar logar com Google — o Google não bloqueia isso.
    // Quem não está na allowlist é devolvido para a tela de login com o aviso, e
    // nenhuma sessão é criada (critério 8.1: "não cria sessão de admin, mesmo
    // estando autenticado no Google"). Retornar uma URL aqui redireciona sem logar.
    signIn({ user }) {
      if (isAdminEmail(user.email)) return true
      return '/admin/login?erro=sem-acesso'
    },
  },
})

// Resultado da guarda de admin: ou o e-mail autorizado, ou a resposta HTTP pronta
// que a rota deve devolver sem tocar em Sheets/Drive.
export type ResultadoGuardaAdmin =
  | { autorizado: true; email: string }
  | { autorizado: false; resposta: NextResponse }

// Guarda obrigatória de toda rota sob /api/admin/* (seção 6). Devolve 401 quando
// não há sessão e 403 quando há sessão mas o e-mail não está em
// ADMIN_ALLOWED_EMAILS — sempre antes de qualquer leitura ou escrita no Google.
export async function requireAdmin(): Promise<ResultadoGuardaAdmin> {
  const sessao = await auth()
  const email = sessao?.user?.email ?? null

  if (!email) {
    return {
      autorizado: false,
      resposta: NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 }),
    }
  }

  if (!isAdminEmail(email)) {
    return {
      autorizado: false,
      resposta: NextResponse.json(
        { erro: 'Esse e-mail não tem acesso ao painel.' },
        { status: 403 },
      ),
    }
  }

  return { autorizado: true, email }
}

// Diz se quem está fazendo a requisição é um admin logado, sem devolver erro.
// Usada pelas rotas públicas para liberar a prévia de rascunho ao Alexandre
// mantendo o 404 para o visitante (seções 6 e 13, critério 8.3).
export async function isAdminRequest(): Promise<boolean> {
  const sessao = await auth()
  return isAdminEmail(sessao?.user?.email)
}
