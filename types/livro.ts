// Tipos que espelham as coleções do Firestore (spec seção 7).
//
// Os nomes de campo ficam em português, iguais aos do banco, para que o que se vê
// no console do Firebase e o que o código manipula sejam a mesma coisa (convenção
// da seção 18). O código em volta permanece em inglês.
//
// As datas trafegam como string ISO 8601, e não como Timestamp do Firestore: no
// banco elas são Timestamp de verdade (ordenação e consulta dependem disso), mas
// o mapeamento converte na fronteira. Sem isso, todo componente de servidor que
// passasse um documento adiante quebraria na serialização.

// Faixa de limite de livros da conta (regra 11.8).
//
// `early_adopter` é quem entrou enquanto a plataforma estava aberta (regra
// 11.14) — livros ilimitados, para sempre. `ilimitado` é o plano das contas do
// próprio dono da plataforma (regra 11.13).
//
// O valor `early_adopter` está em inglês, ao contrário dos outros: é o nome que
// o produto dá à categoria, e é a palavra que o dono vai procurar no console do
// Firebase. Traduzi-lo honraria a letra da convenção de idioma e trairia o
// motivo dela.
export type Plano =
  | 'gratuito'
  | 'early_adopter'
  | 'ate_20'
  | 'ate_50'
  | 'ate_100'
  | 'ilimitado'

// O que o admin da plataforma pode fazer, registrado em `acoes_admin` (seção 7).
export type AcaoAdmin =
  | 'alterou_plano'
  | 'alterou_handle'
  | 'removeu_livro'
  | 'consultou_conta'

// Uma conta. Id do documento = `sub` do Google; o e-mail nunca é chave, porque
// e-mail de conta Google pode mudar (seção 6).
export interface Usuario {
  id: string
  email: string
  nome: string | null
  // Nulo até o primeiro acesso concluir a escolha — o único estado em que a
  // conta existe sem URL pública (seção 7).
  handle: string | null
  plano: Plano
  // Bytes servidos no mês corrente, para a válvula da regra 11.11.
  trafego_mes_bytes: number
  // `AAAA-MM`. Quando não bate com o mês de hoje, o contador zera.
  trafego_mes_referencia: string
  criado_em: string
  atualizado_em: string
}

// Um livro. Pertence a exatamente uma conta pelo `dono_id` — não existe livro
// sem dono, e é essa comparação, não a URL, que define o que a pessoa alcança.
export interface Livro {
  id: string
  dono_id: string
  titulo: string
  subtitulo: string | null
  // Único por dono, nunca globalmente: o namespace é por autor (regra 11.3).
  slug: string
  autor: string
  descricao: string | null
  // Caminhos no Storage. Nunca chegam ao navegador (seção 4).
  arquivo_pdf_caminho: string
  arquivo_pdf_tamanho_bytes: number | null
  capa_caminho: string | null
  total_paginas: number | null
  publicado: boolean
  // Despublicado pelo admin da plataforma; o dono não consegue republicar (regra 11.12).
  removido_por_denuncia: boolean
  criado_em: string
  atualizado_em: string
}

// O que o público pode ver de um livro. Os caminhos do Storage e o dono ficam de
// fora: o navegador só alcança PDF e capa pelas rotas de proxy (seção 4).
export type LivroPublico = Omit<
  Livro,
  'dono_id' | 'arquivo_pdf_caminho' | 'capa_caminho' | 'removido_por_denuncia'
> & { tem_capa: boolean }

// O que o público pode ver de um autor na vitrine. Sem e-mail (critério 8.5).
export interface AutorPublico {
  handle: string
  nome: string | null
}

// Campos que o autor edita no formulário de metadados (épico 8.2).
export interface LivroMetadados {
  titulo: string
  subtitulo: string | null
  slug: string
  autor: string
  descricao: string | null
}
