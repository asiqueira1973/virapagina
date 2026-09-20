// /admin/contas/[id] — detalhe de uma conta (spec seção 10, épico 8.7).
//
// Mostra uso e tráfego, e reúne as três ações do admin. Os livros listados são
// **só os publicados**: rascunho de terceiro não aparece aqui (nota da seção 5).
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AccountActions } from '@/components/platform/AccountActions'
import { isAdminEmail } from '@/lib/admins'
import { ordenarPorCriadoEmDesc } from '@/lib/books'
import { formatarData, formatarTrafego } from '@/lib/format'
import { buscarUsuarioPorId, listarLivrosDoDono } from '@/lib/firebase/firestore'
import { PLANOS, fracaoDaFranquia, limiteDeLivros } from '@/lib/planos'
import { dominioDoSite } from '@/lib/site'

export const metadata: Metadata = { title: 'Conta' }
export const dynamic = 'force-dynamic'

export default async function ContaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conta = await buscarUsuarioPorId(id)
  if (!conta) notFound()

  const livros = await listarLivrosDoDono(conta.id)
  const publicados = ordenarPorCriadoEmDesc(livros.filter((livro) => livro.publicado))
  const limite = limiteDeLivros(conta.plano)
  const fracao = fracaoDaFranquia(conta.plano, conta.trafego_mes_bytes)
  const franquia = PLANOS[conta.plano].franquiaTrafegoBytes

  return (
    <>
      <div className="mb-[26px]">
        <Link
          href="/admin/contas"
          className="mb-3 inline-block text-[13px] text-tinta-apagada hover:text-tinta"
        >
          ← Contas
        </Link>
        <h1 className="text-[25px] font-semibold tracking-[-0.02em]">{conta.email}</h1>
        <p className="mt-1 text-[13px] text-tinta-apagada">
          {conta.handle ? `${dominioDoSite()}/${conta.handle}` : 'ainda sem endereço'} · conta desde{' '}
          {formatarData(conta.criado_em)}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-[440px] flex-1">
          <AccountActions
            conta={conta}
            ehDonoDaPlataforma={isAdminEmail(conta.email)}
            publicados={publicados}
          />
        </div>

        <aside className="w-[300px] shrink-0 rounded-[14px] border border-hairline bg-superficie p-5">
          <h2 className="mb-3.5 text-[15px] font-semibold">Uso</h2>

          <div className="mb-1.5 flex justify-between text-[12px] text-tinta-apagada">
            <span>Livros</span>
            <span className="text-tinta-media">
              {limite === null ? livros.length : `${livros.length} de ${limite}`}
            </span>
          </div>
          <div className="mb-4 h-[5px] overflow-hidden rounded-full bg-preenchimento">
            <div
              className="h-full rounded-full bg-acao"
              style={{
                width: limite === null ? '100%' : `${Math.min(100, (livros.length / limite) * 100)}%`,
              }}
            />
          </div>

          <div className="mb-1.5 flex justify-between text-[12px] text-tinta-apagada">
            <span>Tráfego do mês</span>
            <span className={fracao !== null && fracao >= 0.8 ? 'text-perigo' : 'text-tinta-media'}>
              {formatarTrafego(conta.trafego_mes_bytes)}
              {franquia !== null ? ` de ${Math.round(franquia / 1024 ** 3)} GB` : ''}
            </span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-full bg-preenchimento">
            <div
              className={`h-full rounded-full ${fracao !== null && fracao >= 0.8 ? 'bg-perigo' : 'bg-acao'}`}
              style={{ width: `${Math.round(Math.min(1, fracao ?? 0) * 100)}%` }}
            />
          </div>

          <p className="mt-3.5 text-[12px] leading-relaxed text-tinta-apagada">
            Passar da franquia não corta nada e não cobra nada — só levanta a mão para
            conversarmos.
          </p>
        </aside>
      </div>
    </>
  )
}
