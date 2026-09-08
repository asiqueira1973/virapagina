// /admin/login — porta de entrada do painel (spec épico 8.1).
// Botão único "Entrar com Google": não existe usuário e senha próprios nem tela
// de criar conta, o acesso é definido pela allowlist ADMIN_ALLOWED_EMAILS
// (seções 5 e 6). Sem menu lateral — quem está aqui ainda não está autenticado.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth, signIn } from '@/lib/google/auth'
import { isAdminEmail } from '@/lib/google/config'
import { COPY } from '@/lib/copy'

export const metadata: Metadata = { title: 'Entrar' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  // Quem já está logado e autorizado não precisa ver esta tela de novo.
  const sessao = await auth()
  if (isAdminEmail(sessao?.user?.email)) redirect('/admin/livros')

  const { erro } = await searchParams
  // O callback de signIn devolve para cá com ?erro=sem-acesso quando o e-mail do
  // Google não está na allowlist — e nenhuma sessão de admin foi criada.
  const semAcesso = erro === 'sem-acesso'

  return (
    <main className="flex min-h-screen items-center justify-center bg-tela px-6 py-16">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-[4px] bg-destaque" aria-hidden="true" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Virapágina</span>
        </div>

        <div className="rounded-2xl border border-hairline bg-superficie p-7">
          <h1 className="mb-1 text-[21px] font-semibold tracking-[-0.02em]">Entrar</h1>
          <p className="mb-6 text-[13px] text-tinta-apagada">
            O painel é de uso pessoal. Entre com a conta Google autorizada.
          </p>

          {semAcesso ? (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-perigo-borda bg-perigo-fundo px-3.5 py-3 text-[13px] text-perigo"
            >
              {COPY.acessoNegado}
            </p>
          ) : null}

          <form
            action={async () => {
              'use server'
              // Leva direto para a lista de livros no sucesso (critério 8.1).
              await signIn('google', { redirectTo: '/admin/livros' })
            }}
          >
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-[10px] bg-destaque px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-destaque-escuro"
            >
              <GoogleIcon />
              Entrar com Google
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

// Marca do Google no botão de login, nas cores oficiais.
function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.2-5.2C29.8 35.1 27 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.2C36.9 40.2 44 35 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}
