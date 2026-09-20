// /admin/contas — lista das contas da plataforma (spec seção 10, épico 8.7).
//
// Mostra plano, quantidade de livros e tráfego do mês contra a franquia.
// **Não mostra rascunho de ninguém**: rascunho é material não publicado de outra
// pessoa, e dar acesso a isso por conveniência de suporte é o começo do
// vazamento entre contas (nota da seção 5).
import type { Metadata } from 'next'
import Link from 'next/link'
import { isAdminEmail } from '@/lib/admins'
import { earlyAdopterAberto } from '@/lib/flags'
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
  const earlyAdopters = contas.filter((conta) => conta.plano === 'early_adopter').length
  const aberta = earlyAdopterAberto()

  return (
    <>
      <div className="mb-[26px]">
        <h1 className="mb-[5px] text-[26px] font-bold tracking-tight">Contas</h1>
        <p className="text-[13px] text-tinta-apagada">
          {contas.length} {contas.length === 1 ? 'conta' : 'contas'}
          {earlyAdopters > 0 ? ` · ${earlyAdopters} early adopter${earlyAdopters === 1 ? '' : 's'}` : ''}
          {emAlerta > 0 ? ` · ${emAlerta} acima de 80% da franquia de tráfego` : ''}
        </p>
      </div>

      {/* O estado da chave da regra 11.14 fica visível aqui porque é onde ele
          importa: é olhando a lista de contas que se decide fechar a porta. */}
      <div
        className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-[18px] py-3.5 ${
          aberta ? 'border-traco-forte bg-superficie-2' : 'border-traco bg-superficie'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${aberta ? 'bg-tinta' : 'bg-traco-forte'}`}
        />
        <p className={`text-[13px] ${aberta ? 'text-tinta' : 'text-tinta-fraca'}`}>
          {aberta ? (
            <>
              <strong className="font-semibold">Aberta a early adopters.</strong> Toda conta nova
              nasce com livros ilimitados, para sempre.
            </>
          ) : (
            <>
              <strong className="font-semibold">Fechada a early adopters.</strong> Conta nova nasce
              no plano gratuito. Quem já entrou continua ilimitado.
            </>
          )}
        </p>
        <span className="ml-auto font-mono text-[12px] text-tinta-apagada">
          EARLY_ADOPTER_ABERTO={aberta ? 'true' : 'false'}
        </span>
      </div>

      {contas.length === 0 ? (
        <p className="text-[15px] text-tinta-apagada">Nenhuma conta ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-traco bg-superficie">
          <div className="grid grid-cols-[2fr_1.2fr_1.1fr_0.9fr_1.4fr_0.7fr] gap-4 border-b border-traco bg-superficie-2 px-[18px] py-3 text-[12px] font-semibold text-tinta-apagada">
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
              className="grid grid-cols-[2fr_1.2fr_1.1fr_0.9fr_1.4fr_0.7fr] items-center gap-4 border-b border-traco px-[18px] py-3.5 text-[13px] last:border-b-0"
            >
              <span className="truncate font-medium">{conta.email}</span>
              <span className="truncate text-tinta-fraca">
                {conta.handle ? `/${conta.handle}` : '—'}
              </span>
              <span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    conta.ehDono
                      ? 'bg-plataforma-fundo text-plataforma'
                      : conta.plano === 'early_adopter'
                        ? 'bg-publicado-fundo text-publicado'
                        : 'bg-ativo text-tinta-apagada'
                  }`}
                >
                  {PLANOS[conta.plano].rotulo}
                </span>
              </span>
              <span className="text-tinta-media">
                {conta.limite === null ? conta.quantidade : `${conta.quantidade} de ${conta.limite}`}
              </span>
              <span className="flex items-center gap-2.5">
                <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-ativo">
                  <span
                    className={`block h-full rounded-full ${conta.emAlerta ? 'bg-perigo' : 'bg-tinta'}`}
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
                  className="text-[12px] font-medium text-tinta hover:underline"
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
