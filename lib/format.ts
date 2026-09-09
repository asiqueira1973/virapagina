// Formatação de valores para exibição na interface, sempre em pt-BR (seção 17).

// Data curta para a coluna "atualizado em" (critério 8.2). O fuso é fixado em
// São Paulo para o texto não mudar conforme o servidor que renderizou a página.
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

// Tamanho de arquivo legível. Nulo vira travessão — a extração pode ter falhado
// sem bloquear a publicação (seção 7).
export function formatarTamanho(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Tráfego do mês contra a franquia, para o painel da plataforma (regra 11.11).
// Zero bytes vira travessão: mostrar "0,0 GB" dá a impressão de medição quando o
// que houve foi ausência de leitura.
export function formatarTrafego(bytes: number): string {
  if (!bytes) return '—'
  const gb = bytes / 1024 ** 3
  if (gb >= 0.1) return `${gb.toFixed(1).replace('.', ',')} GB`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}
