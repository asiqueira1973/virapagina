// /entrar — porta de entrada (spec seção 10, épico 8.1).
//
// Botão único "Entrar com Google". Não existe usuário e senha próprios nem
// allowlist para autores: qualquer conta Google entra e vira Autor no plano
// gratuito (seção 6). Sem menu lateral — quem está aqui ainda não entrou.
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signIn } from '@/lib/auth'

export const metadata: Metadata = { title: 'Entrar' }

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string }>
}) {
  // Quem já está logado não precisa ver esta tela de novo.
  const sessao = await auth()
  if (sessao?.user?.email) redirect('/conta/livros')

  const { voltar } = await searchParams
  // Só caminho interno é aceito como destino, para o parâmetro não virar um
  // redirecionamento aberto para fora do site.
  const destino = voltar?.startsWith('/conta') ? voltar : '/conta/livros'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-superficie px-6 py-16">
      <div className="w-full max-w-[380px]">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-[4px] bg-tinta" aria-hidden="true" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-tinta">Virapágina</span>
        </Link>

        <div className="rounded-2xl border border-traco bg-superficie p-7">
          <h1 className="mb-1 text-[21px] font-bold tracking-tight">Entrar</h1>
          <p className="mb-6 text-[13px] leading-relaxed text-tinta-apagada">
            Sua conta é criada na primeira vez que você entrar. Não pedimos senha nem cartão.
          </p>

          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: destino })
            }}
          >
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-tinta px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-tinta-media"
            >
              <IconeDoGoogle />
              Entrar com Google
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-tinta-apagada">
          Ao entrar, você concorda com os <Link href="/termos">termos de uso</Link> e a{' '}
          <Link href="/privacidade">política de privacidade</Link>.
        </p>
      </div>
    </main>
  )
}

// Marca do Google no botão de login, nas cores oficiais.
function IconeDoGoogle() {
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
