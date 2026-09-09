'use client'

// As três ações do admin da plataforma sobre uma conta (spec épico 8.7):
// alterar o plano, trocar o endereço público e remover um livro por denúncia.
//
// Nenhuma delas mexe em livro por efeito colateral: mudar de plano não exclui,
// não despublica e não bloqueia leitura de nada (regra 11.9), e remover um livro
// despublica sem apagar o arquivo, porque remoção indevida precisa ser
// reversível (critério 8.7).
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/account/ConfirmDialog'
import { COPY } from '@/lib/copy'
import { PLANOS } from '@/lib/planos'
import type { Livro, Plano, Usuario } from '@/types/livro'

// As faixas que o admin pode conceder à mão. `ilimitado` fica de fora: ele é
// automático para os e-mails da plataforma e não se dá a ninguém (regra 11.13).
const FAIXAS: Plano[] = ['gratuito', 'ate_20', 'ate_50', 'ate_100']

export function AccountActions({
  conta,
  ehDonoDaPlataforma,
  publicados,
}: {
  conta: Usuario
  ehDonoDaPlataforma: boolean
  publicados: Livro[]
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [novoHandle, setNovoHandle] = useState(conta.handle ?? '')
  const [aRemover, setARemover] = useState<Livro | null>(null)

  async function chamar(url: string, corpo: unknown) {
    setErro(null)
    setOcupado(true)
    try {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null)
        setErro(dados?.erro ?? COPY.erroGenerico)
        return false
      }
      router.refresh()
      return true
    } catch (falha) {
      console.error(`Falha em ${url}:`, falha)
      setErro(COPY.erroGenerico)
      return false
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      {erro ? (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-perigo-borda bg-perigo-fundo px-3.5 py-3 text-[13px] text-perigo"
        >
          {erro}
        </p>
      ) : null}

      <section className="mb-5 rounded-[14px] border border-hairline bg-superficie p-5">
        <h2 className="mb-1 text-[15px] font-semibold">Plano</h2>
        <p className="mb-4 text-[12px] leading-relaxed text-tinta-apagada">
          Alterar o plano não mexe em livro nenhum: nada é excluído, despublicado ou bloqueado
          para leitura, mesmo que a conta fique acima do novo limite.
        </p>

        {ehDonoDaPlataforma ? (
          <p className="text-[13px] text-tinta-suave">
            Esta é uma conta da plataforma: ela é ilimitada por definição e o plano não é
            alterável.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {FAIXAS.map((faixa) => {
              const atual = conta.plano === faixa
              return (
                <button
                  key={faixa}
                  type="button"
                  disabled={ocupado || atual}
                  onClick={() => chamar(`/api/admin/contas/${conta.id}/plano`, { plano: faixa })}
                  className={`cursor-pointer rounded-full border px-3.5 py-[7px] text-[13px] font-medium transition-colors disabled:cursor-default ${
                    atual
                      ? 'border-destaque bg-destaque-fraco text-destaque'
                      : 'border-hairline-forte bg-superficie text-tinta-media hover:bg-tela'
                  }`}
                >
                  {PLANOS[faixa].rotulo}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="mb-5 rounded-[14px] border border-hairline bg-superficie p-5">
        <h2 className="mb-1 text-[15px] font-semibold">Endereço público</h2>
        <p className="mb-4 text-[12px] leading-relaxed text-tinta-apagada">
          O autor não troca o próprio endereço. Trocar aqui quebra os links que já circulam —
          faça só quando alguém pedir.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-[240px] flex-1 items-center overflow-hidden rounded-[10px] border border-hairline-forte bg-superficie focus-within:border-destaque">
            <span className="shrink-0 border-r border-hairline bg-tela px-2.5 py-[9px] text-[12px] text-tinta-apagada">
              /
            </span>
            <input
              type="text"
              value={novoHandle}
              onChange={(evento) => setNovoHandle(evento.target.value.toLowerCase())}
              disabled={ocupado}
              spellCheck={false}
              className="min-w-0 flex-1 px-2.5 py-[9px] text-[13px] outline-none"
            />
          </div>
          <button
            type="button"
            disabled={ocupado || !novoHandle || novoHandle === conta.handle}
            onClick={() => chamar(`/api/admin/contas/${conta.id}/handle`, { handle: novoHandle })}
            className="cursor-pointer rounded-[10px] border border-hairline-forte bg-superficie px-3.5 py-2 text-[13px] font-medium text-tinta-media transition-colors hover:bg-tela disabled:cursor-not-allowed disabled:opacity-60"
          >
            Alterar endereço
          </button>
        </div>
      </section>

      <section className="rounded-[14px] border border-hairline bg-superficie p-5">
        <h2 className="mb-1 text-[15px] font-semibold">Livros publicados</h2>
        <p className="mb-4 text-[12px] leading-relaxed text-tinta-apagada">
          Só os publicados aparecem aqui — rascunho de outra pessoa não é assunto do painel da
          plataforma. Remover despublica e marca; o arquivo não é apagado.
        </p>

        {publicados.length === 0 ? (
          <p className="text-[13px] text-tinta-apagada">Nenhum livro publicado.</p>
        ) : (
          <ul className="flex flex-col">
            {publicados.map((livro) => (
              <li
                key={livro.id}
                className="flex items-center gap-3.5 border-b border-preenchimento-fraco py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{livro.titulo}</div>
                  <div className="truncate text-[12px] text-tinta-apagada">
                    /{conta.handle}/{livro.slug}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setARemover(livro)}
                  className="shrink-0 cursor-pointer rounded-lg border border-perigo-borda bg-perigo-fundo px-3 py-[5px] text-[12px] font-semibold text-perigo transition-colors hover:bg-[#fbe6e6] disabled:opacity-60"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        aberto={aRemover !== null}
        mensagem={`Despublicar "${aRemover?.titulo ?? ''}" por violar os termos? O arquivo não é apagado e a ação fica registrada.`}
        rotuloConfirmar="Remover"
        perigo
        aoConfirmar={async () => {
          const livro = aRemover
          setARemover(null)
          if (livro) await chamar(`/api/admin/livros/${livro.id}/remover`, {})
        }}
        aoCancelar={() => setARemover(null)}
      />
    </>
  )
}
