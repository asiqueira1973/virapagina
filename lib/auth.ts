// Configuração do Auth.js (spec seção 6, épico 8.1).
//
// Este arquivo é deliberadamente **seguro para o Edge Runtime**: ele não importa
// o Firebase Admin SDK, que é só de Node. O `middleware.ts` precisa de `auth()`
// e roda no Edge — se a configuração puxasse o Firestore, o middleware nem
// carregaria. As guardas que tocam o banco vivem em `lib/guards.ts`.
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  // Sessão em JWT: não há banco de sessão, e 30 dias com renovação silenciosa é
  // o que a seção 6 define.
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/entrar', error: '/entrar' },
  providers: [
    Google({
      // Os nomes das variáveis são os da seção 18, então vão na mão em vez de
      // deixar o Auth.js adivinhar pelos nomes padrão dele.
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Qualquer conta Google entra: não existe allowlist para autores (critério
    // 8.1). Quem decide o que a pessoa alcança depois é a guarda, não o login.
    signIn() {
      return true
    },
    // Guarda o `sub` do Google no token. É ele que vira o id do documento em
    // `usuarios` (seção 6) — o e-mail nunca é chave, porque pode mudar.
    jwt({ token, profile }) {
      if (profile?.sub) token.sub = profile.sub
      return token
    },
    // Expõe o id na sessão, para as guardas não precisarem decodificar token.
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub
      return session
    },
  },
})
