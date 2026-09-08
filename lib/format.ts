// Formatação de valores para exibição na interface, sempre em pt-BR (seção 17).

// Data curta para a coluna "atualizado em" da lista do admin (critério 8.2).
// O fuso é fixado em São Paulo para o texto não mudar conforme o servidor que
// renderizou a página.
export function formatarData(iso: string): string {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

// Tamanho de arquivo legível, exibido no admin (seção 7: o campo existe para
// conferência visual). Nulo vira travessão — a extração pode ter falhado sem
// bloquear a publicação.
export function formatarTamanho(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
