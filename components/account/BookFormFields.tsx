'use client'

// Campos de metadados do livro, compartilhados pelas telas de criação e edição
// (spec seção 10, épico 8.2). Componente puramente de apresentação: quem cuida
// de salvar é a tela que o usa.
import { COPY } from '@/lib/copy'

// Formato dos metadados enquanto estão sendo editados na tela. Tudo string aqui,
// inclusive o que vira null na planilha — o formulário não conhece null.
export interface MetadadosEmEdicao {
  titulo: string
  subtitulo: string
  slug: string
  autor: string
  descricao: string
}

export function BookFormFields({
  handle,
  valores,
  aoMudar,
  erroDeSlug,
  sugestaoDeSlug,
  aoAceitarSugestao,
  desabilitado = false,
}: {
  // O endereço do autor forma o prefixo do link do livro: /<handle>/<slug>.
  handle: string
  valores: MetadadosEmEdicao
  aoMudar: (campo: keyof MetadadosEmEdicao, valor: string) => void
  erroDeSlug?: string | null
  sugestaoDeSlug?: string | null
  aoAceitarSugestao?: (slug: string) => void
  desabilitado?: boolean
}) {
  return (
    <div className="flex flex-col gap-5">
      <Campo rotulo="Título" obrigatorio>
        <input
          type="text"
          value={valores.titulo}
          onChange={(evento) => aoMudar('titulo', evento.target.value)}
          disabled={desabilitado}
          required
          className={estiloDeCampo}
          placeholder="Conceitos de Tecnologia para Pessoas Executivas"
        />
      </Campo>

      <Campo rotulo="Subtítulo" opcional>
        <input
          type="text"
          value={valores.subtitulo}
          onChange={(evento) => aoMudar('subtitulo', evento.target.value)}
          disabled={desabilitado}
          className={estiloDeCampo}
        />
      </Campo>

      <Campo
        rotulo="Link"
        // O slug é sugerido a partir do título e continua editável (regra 11.3).
        ajuda="Endereço público do livro. Só letras minúsculas, números e hífen."
      >
        <div className="flex items-center gap-0 overflow-hidden rounded-[10px] border border-hairline-forte bg-superficie focus-within:border-destaque">
          <span className="shrink-0 border-r border-hairline bg-tela px-3 py-2.5 text-[13px] text-tinta-apagada">
            /{handle}/
          </span>
          <input
            type="text"
            value={valores.slug}
            onChange={(evento) => aoMudar('slug', evento.target.value)}
            disabled={desabilitado}
            className="min-w-0 flex-1 px-3 py-2.5 text-[14px] outline-none"
            spellCheck={false}
          />
        </div>
        {erroDeSlug ? (
          <p role="alert" className="mt-2 text-[13px] text-perigo">
            {erroDeSlug}
            {sugestaoDeSlug && aoAceitarSugestao ? (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => aoAceitarSugestao(sugestaoDeSlug)}
                  className="cursor-pointer font-medium text-destaque underline"
                >
                  Usar {sugestaoDeSlug}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </Campo>

      <Campo rotulo="Autor">
        <input
          type="text"
          value={valores.autor}
          onChange={(evento) => aoMudar('autor', evento.target.value)}
          disabled={desabilitado}
          className={estiloDeCampo}
          // Em branco vira o nome da conta no servidor (seção 7).
          placeholder="Seu nome"
        />
      </Campo>

      <Campo
        rotulo="Descrição"
        opcional
        ajuda="Aparece na sua vitrine e no card de quem compartilhar o link."
      >
        <textarea
          value={valores.descricao}
          onChange={(evento) => aoMudar('descricao', evento.target.value)}
          disabled={desabilitado}
          rows={3}
          className={`${estiloDeCampo} resize-y`}
        />
      </Campo>
    </div>
  )
}

const estiloDeCampo =
  'w-full rounded-[10px] border border-hairline-forte bg-superficie px-3 py-2.5 text-[14px] outline-none focus:border-destaque disabled:bg-tela disabled:text-tinta-apagada'

// Rótulo + ajuda + campo, no espaçamento generoso do sistema visual (seção 16).
function Campo({
  rotulo,
  ajuda,
  obrigatorio,
  opcional,
  children,
}: {
  rotulo: string
  ajuda?: string
  obrigatorio?: boolean
  opcional?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-tinta-media">
        {rotulo}
        {obrigatorio ? <span className="text-perigo"> *</span> : null}
        {opcional ? <span className="font-normal text-tinta-apagada"> (opcional)</span> : null}
      </span>
      {ajuda ? <span className="mb-2 block text-[12px] text-tinta-apagada">{ajuda}</span> : null}
      {children}
    </label>
  )
}

// Barra de progresso do upload. Reflete o progresso real relatado pelo XHR —
// nunca uma animação decorativa (critério 8.2).
export function BarraDeProgresso({ fracao, rotulo }: { fracao: number; rotulo: string }) {
  const porcentagem = Math.round(Math.min(1, Math.max(0, fracao)) * 100)
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[12px] text-tinta-apagada">
        <span>{rotulo}</span>
        <span>{porcentagem}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={porcentagem}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo}
        className="h-1.5 overflow-hidden rounded-full bg-preenchimento"
      >
        <div
          className="h-full rounded-full bg-destaque transition-[width] duration-200"
          style={{ width: `${porcentagem}%` }}
        />
      </div>
    </div>
  )
}

// Caixa de erro do formulário, com a copy da seção 14–15.
export function AvisoDeErro({ mensagem }: { mensagem: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-perigo-borda bg-perigo-fundo px-3.5 py-3 text-[13px] text-perigo"
    >
      {mensagem}
    </p>
  )
}

export { COPY }
