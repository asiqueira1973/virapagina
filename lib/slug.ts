// Geração e validação do slug que forma a URL pública do livro (/l/<slug>).

// Transforma um título em slug: minúsculo, sem acento, kebab-case (regra 11.3).
// É só uma sugestão — o campo continua editável pelo admin antes de salvar.
export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    // Remove os acentos que a normalização separou da letra.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    // Tudo que não é letra, número ou hífen vira hífen.
    .replace(/[^a-z0-9]+/g, '-')
    // Colapsa hífens repetidos e apara as pontas.
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Confere se um slug está no formato aceito: só minúsculas, números e hífen
// (seção 7). Slug vazio é inválido — a URL pública não pode ficar sem identificador.
export function slugValido(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug)
}

// Dado um slug pretendido e os slugs já em uso, devolve o primeiro livre,
// acrescentando -2, -3... como pede o critério de aceite 8.2.
export function proximoSlugLivre(base: string, slugsEmUso: Iterable<string>): string {
  const usados = new Set(slugsEmUso)
  if (!usados.has(base)) return base
  let sufixo = 2
  while (usados.has(`${base}-${sufixo}`)) sufixo += 1
  return `${base}-${sufixo}`
}
