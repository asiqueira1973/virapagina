// Miniatura da capa de um livro, usada na vitrine e no painel do autor.
//
// A imagem vem sempre pela rota de proxy /api/livros/[handle]/[slug]/capa — o
// navegador nunca recebe um caminho do Storage (spec seção 4). Livro sem capa
// gerada mostra um retângulo vazio em vez de imagem quebrada: `capa_caminho`
// nulo é estado previsto (seção 7).
import { comVersao } from '@/lib/cache'

export function BookCover({
  handle,
  slug,
  titulo,
  temCapa,
  versao,
  className = '',
}: {
  handle: string
  slug: string
  titulo: string
  temCapa: boolean
  // Versão dos arquivos do livro (`versaoDosArquivos`). Sem ela, a URL da capa
  // é a mesma antes e depois de substituir o PDF, e o navegador segue mostrando
  // a capa velha (critério 8.2).
  versao: string
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
      src={comVersao(`/api/livros/${handle}/${slug}/capa`, versao)}
      alt={`Capa de ${titulo}`}
      loading="lazy"
      className={`shrink-0 rounded-[5px] border border-hairline bg-preenchimento object-cover ${className}`}
    />
  )
}
