// Tipos que espelham a planilha `livros` do Google Sheets (spec seção 7).
// Os nomes de campo ficam em português, iguais ao cabeçalho da planilha, para que
// o que o Alexandre vê na planilha e o que o código manipula sejam a mesma coisa
// (convenção da seção 18). O código em volta permanece em inglês.

// Valor da coluna K. A planilha não tem boolean nativo confiável entre bibliotecas
// cliente, então a seção 7 fixa as strings "sim"/"nao" para evitar ambiguidade de parsing.
export type PublicadoValor = 'sim' | 'nao'

// Uma linha da planilha `livros` (colunas A–N da seção 7).
export interface Livro {
  id: string
  titulo: string
  subtitulo: string | null
  slug: string
  autor: string
  descricao: string | null
  arquivo_pdf_drive_id: string
  arquivo_pdf_tamanho_bytes: number | null
  capa_drive_id: string | null
  total_paginas: number | null
  publicado: PublicadoValor
  criado_por: string
  criado_em: string
  atualizado_em: string
}

// O que o público pode ver de um livro. Os IDs de arquivo do Drive nunca saem do
// servidor: o navegador acessa o PDF e a capa apenas pelas rotas de proxy
// /api/livros/[slug]/pdf e /api/livros/[slug]/capa (seções 4 e 13).
export type LivroPublico = Omit<Livro, 'arquivo_pdf_drive_id' | 'capa_drive_id' | 'criado_por'> & {
  tem_capa: boolean
}

// Campos que o admin edita no formulário de metadados (épico 8.2).
export interface LivroMetadados {
  titulo: string
  subtitulo: string | null
  slug: string
  autor: string
  descricao: string | null
}
