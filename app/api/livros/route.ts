// GET /api/livros — lista pública do catálogo (spec seção 13, épico 8.5).
// Só devolve livros com publicado = "sim", ordenados do mais recente para o mais
// antigo. Rascunho nunca sai por aqui, nem para o admin: esta rota alimenta o
// catálogo, que é idêntico para todo mundo (regra 11.4 e critério 8.5).
import { NextResponse } from 'next/server'
import { ordenarPorCriadoEmDesc, toLivroPublico } from '@/lib/books'
import { readAllBooksCached } from '@/lib/google/sheets'

// Cache de 60 segundos para não estourar a cota da Sheets API em pico de
// tráfego (regra 11.7). As rotas do admin invalidam essa etiqueta ao escrever.
export const revalidate = 60

export async function GET() {
  try {
    const livros = await readAllBooksCached()
    const publicados = ordenarPorCriadoEmDesc(livros.filter((livro) => livro.publicado === 'sim'))
    return NextResponse.json({ livros: publicados.map(toLivroPublico) })
  } catch (erro) {
    // O detalhe técnico da API do Google fica no log; o usuário vê texto genérico
    // (fluxo de exceção da seção 9).
    console.error('Falha ao ler o catálogo na planilha:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
