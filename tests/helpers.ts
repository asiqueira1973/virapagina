// Utilidades comuns dos testes: um duplo controlável da sessão do Auth.js.
import { vi } from 'vitest'

// Sessão corrente que o mock de `auth()` devolve. Cada teste ajusta este valor.
export const sessaoAtual: { valor: { user?: { email?: string | null } } | null } = {
  valor: null,
}

// Faz o `auth()` do Auth.js devolver a sessão que o teste configurou, sem sair
// para a rede. `requireAdmin()` continua sendo o código real — é ele que está
// sendo testado (seção 22).
export function mockNextAuth() {
  vi.mock('next-auth', () => ({
    default: () => ({
      handlers: { GET: vi.fn(), POST: vi.fn() },
      auth: async () => sessaoAtual.valor,
      signIn: vi.fn(),
      signOut: vi.fn(),
    }),
  }))
  vi.mock('next-auth/providers/google', () => ({ default: () => ({ id: 'google' }) }))
}

// Sem ninguém logado.
export function semSessao() {
  sessaoAtual.valor = null
}

// Logado no Google, mas com e-mail fora de ADMIN_ALLOWED_EMAILS.
export function sessaoDeEstranho() {
  sessaoAtual.valor = { user: { email: 'estranho@exemplo.com' } }
}

// Logado com o e-mail que está na allowlist.
export function sessaoDeAdmin() {
  sessaoAtual.valor = { user: { email: 'alexandre.silva.siqueira@gmail.com' } }
}
