// Como o navegador e a CDN devem guardar o PDF e a capa de um livro (spec seção
// 13.1, critério 8.2).
//
// Fica num módulo à parte, sem import nenhum, porque o leitor é componente de
// cliente: se isso morasse em `lib/books.ts`, que alcança o Firestore, o Admin
// SDK iria junto para o pacote do navegador e o build quebraria.
//
// O único import é de tipo, e some na compilação.
import type { Livro } from '@/types/livro'

// Versão dos arquivos de um livro, para as URLs de proxy do PDF e da capa
// (critério 8.2, seção 13.1).
//
// As rotas de proxy têm endereço fixo: `/api/livros/<handle>/<slug>/pdf` é o
// mesmo antes e depois de substituir o arquivo. Como a URL não muda, o cache do
// navegador e o da CDN continuam entregando o PDF antigo até o prazo vencer — o
// autor troca o arquivo, recarrega a página e vê o livro velho. O `?v=` resolve
// isso mudando a URL junto com o conteúdo.
//
// A fonte é `atualizado_em`, reescrito em toda gravação (inclusive na troca do
// PDF, que regrava tamanho, total de páginas e capa). Em base 36 para caber num
// punhado de caracteres.
export function versaoDosArquivos(livro: Pick<Livro, 'atualizado_em'>): string {
  const instante = Date.parse(livro.atualizado_em)
  return Number.isFinite(instante) ? instante.toString(36) : ''
}

// Acrescenta a versão a uma URL de proxy, preservando o que já estiver na query.
export function comVersao(url: string, versao: string): string {
  if (!versao) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${versao}`
}

// Política de cache das rotas de proxy do PDF e da capa (seção 13.1).
//
// São três situações distintas, e tratá-las igual é o que fazia o arquivo velho
// sobreviver à substituição:
//
// - Rascunho em prévia nunca vai para cache nenhum: ele pode sair do ar a
//   qualquer momento, e cache de CDN sobreviveria ao despublicar (regra 11.4).
// - URL com `?v=` pode ser guardada para sempre: trocar o arquivo troca a URL,
//   então o que está em cache jamais fica errado — só deixa de ser pedido.
// - URL sem versão é link antigo, scraper de rede social ou endereço digitado à
//   mão. Ela precisa revalidar a cada uso; o ETag faz a resposta ser um 304 de
//   poucos bytes quando nada mudou, em vez do PDF inteiro de novo.
export function cabecalhosDeCache(params: {
  publicado: boolean
  versionada: boolean
}): string {
  if (!params.publicado) return 'private, no-store'
  return params.versionada
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=0, must-revalidate'
}
