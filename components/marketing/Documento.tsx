// Casca dos documentos longos — termos e privacidade (spec seção 10).
//
// Coluna estreita e legível, com hierarquia clara. Não usa o `prose` de nenhuma
// biblioteca: o sistema visual do produto já define a tipografia, e trazer outra
// escala aqui faria estas páginas parecerem de outro site.
export function Documento({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string
  atualizadoEm: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-14 sm:px-12">
      <header className="mb-10">
        <h1 className="mb-2 font-display text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
          {titulo}
        </h1>
        <p className="text-[13px] text-tinta-apagada">Atualizado em {atualizadoEm}</p>
      </header>
      <div className="flex flex-col gap-9">{children}</div>
    </main>
  )
}

// Uma seção do documento. Os estilos de parágrafo e tabela ficam aqui, num lugar
// só, em vez de repetidos em cada página.
export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.01em]">{titulo}</h2>
      <div className="flex flex-col gap-3.5 text-[14px] leading-relaxed text-tinta-media [&_a]:font-medium [&_a]:text-tinta [&_a]:underline [&_strong]:font-semibold [&_strong]:text-tinta [&_table]:mt-1 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] [&_td]:border-t [&_td]:border-hairline [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold [&_th]:text-tinta-fraca">
        {children}
      </div>
    </section>
  )
}
