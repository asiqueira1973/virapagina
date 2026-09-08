// Selo de status da lista do admin (critério 8.2): "Publicado" ou "Rascunho".
// São os dois únicos estados que existem — não há arquivado nem agendado (seção 12).
import type { PublicadoValor } from '@/types/livro'

export function StatusBadge({ publicado }: { publicado: PublicadoValor }) {
  const estaPublicado = publicado === 'sim'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${
        estaPublicado
          ? 'bg-publicado-fundo text-publicado'
          : 'bg-preenchimento text-tinta-fraca'
      }`}
    >
      {estaPublicado ? 'Publicado' : 'Rascunho'}
    </span>
  )
}
