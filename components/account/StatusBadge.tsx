// Selo de status do livro (critério 8.2): "Publicado" ou "Rascunho". São os dois
// únicos estados que existem — não há arquivado nem agendado (seção 12).
export function StatusBadge({ publicado }: { publicado: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${
        publicado ? 'bg-publicado-fundo text-publicado' : 'bg-preenchimento text-tinta-fraca'
      }`}
    >
      {publicado ? 'Publicado' : 'Rascunho'}
    </span>
  )
}
