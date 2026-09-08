// Regras de visibilidade e de apresentação dos livros, compartilhadas pelas rotas
// de API e pelas telas do servidor (spec seções 5, 6, 11.4 e 13).
import type { Livro, LivroPublico } from '@/types/livro'

// Um livro está visível para quem faz a requisição quando está publicado, ou
// quando quem pede é um admin logado — o caso da prévia de rascunho (regra 11.4
// e critérios 8.3). Visitante nunca enxerga rascunho.
export function livroVisivelPara(livro: Livro, ehAdmin: boolean): boolean {
  return livro.publicado === 'sim' || ehAdmin
}

// Reduz um livro ao que pode sair do servidor. Os ids de arquivo do Drive e o
// e-mail de quem criou ficam de fora: o navegador só alcança PDF e capa pelas
// rotas de proxy (seção 4).
export function toLivroPublico(livro: Livro): LivroPublico {
  return {
    id: livro.id,
    titulo: livro.titulo,
    subtitulo: livro.subtitulo,
    slug: livro.slug,
    autor: livro.autor,
    descricao: livro.descricao,
    arquivo_pdf_tamanho_bytes: livro.arquivo_pdf_tamanho_bytes,
    total_paginas: livro.total_paginas,
    publicado: livro.publicado,
    criado_em: livro.criado_em,
    atualizado_em: livro.atualizado_em,
    tem_capa: Boolean(livro.capa_drive_id),
  }
}

// Ordena livros do mais recente para o mais antigo pela data de criação, como
// pede o critério de aceite 8.5 do catálogo público.
export function ordenarPorCriadoEmDesc(livros: Livro[]): Livro[] {
  return [...livros].sort((a, b) => b.criado_em.localeCompare(a.criado_em))
}

// Nome de arquivo amigável para o download do PDF: o título do livro, sem os
// caracteres que quebram cabeçalho HTTP ou nome de arquivo (critério 8.4).
export function nomeArquivoDownload(titulo: string): string {
  const limpo = titulo.replace(/[\\/:*?"<>|]/g, '').trim()
  return `${limpo || 'livro'}.pdf`
}
