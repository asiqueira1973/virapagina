// Cliente da Google Sheets API v4 e todas as operações sobre a aba `livros`
// (spec seções 4, 7 e 13). Este é o único lugar do projeto que conhece o formato
// da planilha: se um dia a planilha virar um banco relacional (roadmap seção 28),
// é só este arquivo que muda — as telas e as rotas continuam iguais.
//
// Nada aqui roda no navegador: a credencial da conta de serviço só existe em rota
// de servidor (princípio 0.3 e seção 6).
import { google } from 'googleapis'
import { unstable_cache } from 'next/cache'
import type { Livro, PublicadoValor } from '@/types/livro'
import { proximoSlugLivre } from '../slug'
import { ABA_LIVROS, serviceAccountCredentials, sheetId } from './config'

// Etiqueta de cache das leituras públicas. As rotas do admin invalidam por ela
// depois de qualquer escrita, para que a mudança apareça na hora (regra 11.7).
export const TAG_CACHE_LIVROS = 'livros'

// Ordem das colunas A–N exatamente como definida na seção 7. A planilha é
// posicional: mudar esta ordem sem mudar a planilha corrompe os dados.
const COLUNAS = [
  'id',
  'titulo',
  'subtitulo',
  'slug',
  'autor',
  'descricao',
  'arquivo_pdf_drive_id',
  'arquivo_pdf_tamanho_bytes',
  'capa_drive_id',
  'total_paginas',
  'publicado',
  'criado_por',
  'criado_em',
  'atualizado_em',
] as const

// Primeira linha de dados: a linha 1 da planilha é o cabeçalho (seção 7).
const PRIMEIRA_LINHA_DE_DADOS = 2

// Cliente autenticado da Sheets API, com escopo de leitura e escrita na planilha.
function getSheetsClient() {
  const credenciais = serviceAccountCredentials()
  const auth = new google.auth.JWT({
    email: credenciais.client_email,
    key: credenciais.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

// Converte texto vazio da planilha em null. A planilha devolve "" para célula
// vazia; o tipo Livro usa null para "não preenchido" (seção 7).
function textoOuNulo(valor: string | undefined): string | null {
  const limpo = (valor ?? '').trim()
  return limpo === '' ? null : limpo
}

// Converte uma célula numérica da planilha em número, tolerando vazio.
// `total_paginas` e `arquivo_pdf_tamanho_bytes` são nulos quando a leitura do
// arquivo falhou no upload — e isso não bloqueia a publicação (seção 7).
function numeroOuNulo(valor: string | undefined): number | null {
  const limpo = (valor ?? '').trim()
  if (limpo === '') return null
  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : null
}

// Normaliza a coluna K. Qualquer valor diferente de "sim" é tratado como "nao",
// para que uma célula digitada errado na planilha nunca publique um rascunho
// por acidente (regra 11.4 — o padrão seguro é não publicado).
function publicadoOuNao(valor: string | undefined): PublicadoValor {
  return (valor ?? '').trim().toLowerCase() === 'sim' ? 'sim' : 'nao'
}

// Transforma uma linha crua da planilha no tipo Livro. Devolve null para linha
// sem `id` ou sem `slug` — linha em branco no meio da planilha não vira livro fantasma.
function rowToLivro(row: string[]): Livro | null {
  const id = textoOuNulo(row[0])
  const slug = textoOuNulo(row[3])
  if (!id || !slug) return null

  return {
    id,
    titulo: textoOuNulo(row[1]) ?? '',
    subtitulo: textoOuNulo(row[2]),
    slug,
    autor: textoOuNulo(row[4]) ?? 'Alexandre Siqueira',
    descricao: textoOuNulo(row[5]),
    arquivo_pdf_drive_id: textoOuNulo(row[6]) ?? '',
    arquivo_pdf_tamanho_bytes: numeroOuNulo(row[7]),
    capa_drive_id: textoOuNulo(row[8]),
    total_paginas: numeroOuNulo(row[9]),
    publicado: publicadoOuNao(row[10]),
    criado_por: textoOuNulo(row[11]) ?? '',
    criado_em: textoOuNulo(row[12]) ?? '',
    atualizado_em: textoOuNulo(row[13]) ?? '',
  }
}

// Transforma um Livro na linha de 14 células que a planilha espera (colunas A–N).
// A conferência contra COLUNAS existe porque a planilha é posicional: uma célula
// a mais ou a menos aqui desloca todos os campos da linha em silêncio.
function livroToRow(livro: Livro): string[] {
  const celulas = [
    livro.id,
    livro.titulo,
    livro.subtitulo ?? '',
    livro.slug,
    livro.autor,
    livro.descricao ?? '',
    livro.arquivo_pdf_drive_id,
    livro.arquivo_pdf_tamanho_bytes === null ? '' : String(livro.arquivo_pdf_tamanho_bytes),
    livro.capa_drive_id ?? '',
    livro.total_paginas === null ? '' : String(livro.total_paginas),
    livro.publicado,
    livro.criado_por,
    livro.criado_em,
    livro.atualizado_em,
  ]
  if (celulas.length !== COLUNAS.length) {
    throw new Error(
      `Linha com ${celulas.length} células, mas a planilha tem ${COLUNAS.length} colunas`,
    )
  }
  return celulas
}

// Lê todas as linhas da aba `livros`, sem cache. Usada pelas rotas do admin, que
// precisam sempre do estado atual, e por toda escrita que antes localiza a linha.
export async function readAllBooks(): Promise<Livro[]> {
  const sheets = getSheetsClient()
  const resposta = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `${ABA_LIVROS}!A${PRIMEIRA_LINHA_DE_DADOS}:N`,
  })
  const linhas = (resposta.data.values ?? []) as string[][]
  return linhas.map(rowToLivro).filter((livro): livro is Livro => livro !== null)
}

// Mesma leitura, cacheada por 60 segundos e invalidável por etiqueta (regra 11.7).
// É o que alimenta as telas públicas — catálogo e leitor — para não estourar a
// cota da Sheets API num pico de tráfego depois de um post no LinkedIn (seção 17).
export const readAllBooksCached = unstable_cache(readAllBooks, ['livros-todos'], {
  revalidate: 60,
  tags: [TAG_CACHE_LIVROS],
})

// Localiza a posição de um livro na planilha pelo `id`, devolvendo o índice no
// array e o número real da linha. Necessário porque a Sheets API não tem
// "atualize onde id = X" — toda escrita é endereçada por linha (assunção 24.8).
function localizarLinha(livros: Livro[], id: string): { indice: number; linha: number } | null {
  const indice = livros.findIndex((livro) => livro.id === id)
  if (indice === -1) return null
  return { indice, linha: indice + PRIMEIRA_LINHA_DE_DADOS }
}

// Busca um livro pelo id, sempre com dado fresco (uso do admin).
export async function findBookById(id: string): Promise<Livro | null> {
  const livros = await readAllBooks()
  return livros.find((livro) => livro.id === id) ?? null
}

// Busca um livro pelo slug da URL pública. `usarCache` fica em true nas rotas
// públicas (regra 11.7) e em false na prévia do admin, que nunca pode servir
// um rascunho desatualizado (seção 13).
export async function findBookBySlug(slug: string, usarCache = true): Promise<Livro | null> {
  const livros = usarCache ? await readAllBooksCached() : await readAllBooks()
  return livros.find((livro) => livro.slug === slug) ?? null
}

// Diz se um slug já está em uso, ignorando opcionalmente o próprio livro que está
// sendo editado. A planilha não impõe unicidade — esta checagem no servidor é a
// única garantia que existe (seção 7 e critério 8.2).
export async function slugEmUso(slug: string, exceptoId?: string): Promise<boolean> {
  const livros = await readAllBooks()
  return livros.some((livro) => livro.slug === slug && livro.id !== exceptoId)
}

// Sugere um slug livre acrescentando -2, -3... ao slug pedido, como manda o
// critério de aceite 8.2 para o caso de link duplicado.
export async function sugerirSlugDisponivel(base: string, exceptoId?: string): Promise<string> {
  const livros = await readAllBooks()
  return proximoSlugLivre(
    base,
    livros.filter((livro) => livro.id !== exceptoId).map((livro) => livro.slug),
  )
}

// Acrescenta um livro novo ao fim da planilha (épico 8.2). A linha só é escrita
// depois que o PDF já subiu para o Drive com sucesso (fluxo de exceção da seção 9).
export async function insertBook(livro: Livro): Promise<Livro> {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: `${ABA_LIVROS}!A:N`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [livroToRow(livro)] },
  })
  return livro
}

// Atualiza um livro existente. Reescreve `atualizado_em` sempre — não existe
// trigger de banco aqui, é esta função que mantém o campo em dia (seção 7).
export async function updateBook(id: string, alteracoes: Partial<Livro>): Promise<Livro | null> {
  const livros = await readAllBooks()
  const posicao = localizarLinha(livros, id)
  if (!posicao) return null

  const atualizado: Livro = {
    ...livros[posicao.indice],
    ...alteracoes,
    id,
    atualizado_em: new Date().toISOString(),
  }

  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${ABA_LIVROS}!A${posicao.linha}:N${posicao.linha}`,
    valueInputOption: 'RAW',
    requestBody: { values: [livroToRow(atualizado)] },
  })
  return atualizado
}

// Descobre o id numérico interno da aba `livros`. O deleteDimension abaixo exige
// esse número, que é diferente do id da planilha e não muda com o nome da aba.
async function getAbaLivrosId(): Promise<number> {
  const sheets = getSheetsClient()
  const resposta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId(),
    fields: 'sheets.properties(sheetId,title)',
  })
  const aba = (resposta.data.sheets ?? []).find(
    (item) => item.properties?.title === ABA_LIVROS,
  )
  if (!aba?.properties?.sheetId && aba?.properties?.sheetId !== 0) {
    throw new Error(`Aba "${ABA_LIVROS}" não encontrada na planilha`)
  }
  return aba.properties.sheetId as number
}

// Remove a linha do livro da planilha (regra 11.6 — hard delete, sem lixeira).
// A Sheets API não apaga "a linha do id X": é preciso localizar o índice e pedir
// um deleteDimension por posição (assunção 24.8).
export async function deleteBookRow(id: string): Promise<boolean> {
  const livros = await readAllBooks()
  const posicao = localizarLinha(livros, id)
  if (!posicao) return false

  const sheets = getSheetsClient()
  const abaId = await getAbaLivrosId()
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: abaId,
              dimension: 'ROWS',
              // A API usa índice começando em zero: a linha 2 da planilha é o índice 1.
              startIndex: posicao.linha - 1,
              endIndex: posicao.linha,
            },
          },
        },
      ],
    },
  })
  return true
}
