// Miniatura da capa do livro na lista do admin e nos cards do catálogo.
// A imagem vem sempre pela rota de proxy /api/livros/[slug]/capa — o navegador
// nunca recebe um link do Drive (seção 4). Livro sem capa gerada mostra um
// retângulo vazio em vez de imagem quebrada (capa_drive_id nulo é estado
// previsto na seção 7).
export function BookCover({
  slug,
  titulo,
  temCapa,
  className = '',
}: {
  slug: string
  titulo: string
  temCapa: boolean
  className?: string
}) {
  if (!temCapa) {
    return (
      <div
        className={`shrink-0 rounded-[5px] border border-hairline-tracejada bg-superficie ${className}`}
        aria-hidden="true"
      />
    )
  }

  // A capa vem de uma rota de proxy nossa, não de um host configurável no
  // next/image — por isso a tag simples.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/livros/${slug}/capa`}
      alt={`Capa de ${titulo}`}
      loading="lazy"
      className={`shrink-0 rounded-[5px] border border-hairline bg-preenchimento object-cover ${className}`}
    />
  )
}
