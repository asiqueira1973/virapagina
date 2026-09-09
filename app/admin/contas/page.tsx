// /admin/contas — lista das contas da plataforma (spec seção 10, épico 8.7).
//
// Mostra plano, quantidade de livros e tráfego do mês contra a franquia.
// **Não mostra rascunho de ninguém**: rascunho é material não publicado de outra
// pessoa, e dar acesso a isso por conveniência de suporte é o começo do
// vazamento entre contas (nota da seção 5).
import type { Metadata } from 'next'
import Link from 'next/link'
import { isAdminEmail } from '@/lib/admins'
import { formatarTrafego } from '@/lib/format'
import { contarLivrosDoDono, listarUsuarios } from '@/lib/firebase/firestore'
import { LIMIAR_AVISO_AUTOR, PLANOS, fracaoDaFranquia, limiteDeLivros } from '@/lib/planos'

export const metadata: Metadata = { title: 'Contas' }
export const dynamic = 'force-dynamic'

export default async function ContasPage() {
  const usuarios = await listarUsuarios()
  const contas = await Promise.all(
    usuarios.map(async (usuario) => {
      const quantidade = await contarLivrosDoDono(usuario.id)
      const fracao = fracaoDaFranquia(usuario.plano, usuario.trafego_mes_bytes)
      const limite = limiteDeLivros(usuario.plano)
      return {
        ...usuario,
        quantidade,
        limite,
        fracao,
        emAlerta: fracao !== null && fracao >= LIMIAR_AVISO_AUTOR,
        ehDono: isAdminEmail(usuario.email),
      }
    }),
  )

  const emAlerta = contas.filter((conta) => conta.emAlerta).length

  return (
    <>
      <div className="mb-[26px]">
        <h1 className="mb-[5px] text-[25px] font-semibold tracking-[-0.02em]">Contas</h1>
        <p className="text-[13px] text-tinta-apagada">
          {contas.length} {contas.length === 1 ? 'conta' : 'contas'}
          {emAlerta > 0 ? ` · ${emAlerta} acima de 80% da franquia de tráfego` : ''}
        </p>
      </div>

      {contas.length === 0 ? (
        <p className="text-[15px] text-tinta-apagada">Nenhuma conta ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-hairline bg-superficie">
          <div className="grid grid-cols-[2fr_1.2fr_1.1fr_0.9fr_1.4fr_0.7fr] gap-4 border-b border-hairline bg-superficie-suave px-[18px] py-3 text-[12px] font-semibold text-tinta-fraca">
            <span>Conta</span>
            <span>Endereço</span>
            <span>Plano</span>
            <span>Livros</span>
            <span>Tráfego do mês</span>
            <span />
          </div>

          {contas.map((conta) => (
            <div
              key={conta.id}
              className="grid grid-cols-[2fr_1.2fr_1.1fr_0.9fr_1.4fr_0.7fr] items-center gap-4 border-b border-preenchimento-fraco px-[18px] py-3.5 text-[13px] last:border-b-0"
            >
              <span className="truncate font-medium">{conta.email}</span>
              <span className="truncate text-tinta-suave">
                {conta.handle ? `/${conta.handle}` : '—'}
              </span>
              <span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-medium ${
                    conta.ehDono
                      ? 'bg-destaque-fraco text-destaque'
                      : 'bg-preenchimento text-tinta-fraca'
                  }`}
                >
                  {PLANOS[conta.plano].rotulo}
                </span>
              </span>
              <span className="text-tinta-media">
                {conta.limite === null ? conta.quantidade : `${conta.quantidade} de ${conta.limite}`}
              </span>
              <span className="flex items-center gap-2.5">
                <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-preenchimento">
                  <span
                    className={`block h-full rounded-full ${conta.emAlerta ? 'bg-perigo' : 'bg-destaque'}`}
                    style={{ width: `${Math.round(Math.min(1, conta.fracao ?? 0) * 100)}%` }}
                  />
                </span>
                <span
                  className={`shrink-0 text-[12px] ${conta.emAlerta ? 'text-perigo' : 'text-tinta-apagada'}`}
                >
                  {formatarTrafego(conta.trafego_mes_bytes)}
                </span>
              </span>
              <span className="text-right">
                <Link
                  href={`/admin/contas/${conta.id}`}
                  className="text-[12px] font-medium text-destaque hover:underline"
                >
                  Abrir
                </Link>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
