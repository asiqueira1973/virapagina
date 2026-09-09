// Acrescenta o `id` ao tipo de sessão do Auth.js. Ele guarda o `sub` do Google,
// que é o id do documento em `usuarios` (spec seção 6).
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
