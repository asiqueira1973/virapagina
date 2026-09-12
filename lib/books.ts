// Regras de visibilidade e de apresentação dos livros, compartilhadas pelas
// rotas públicas e pelas telas de servidor (spec seções 5, 6, 11.4 e 13).
//
// A função que importa aqui é `resolverLivroPublico`: é ela que decide o que um
// visitante enxerga. Sem RLS por baixo, ela é a única coisa entre o público e os
// rascunhos de todo mundo.
import { comVersao, versaoDosArquivos } from '@/lib/cache'
import { buscarLivroPorDonoESlug, buscarUsuarioPorHandle } from '@/lib/firebase/firestore'
import { urlDoSite } from '@/lib/site'
import type { AutorPublico, Livro, LivroPublico, Usuario } from '@/types/livro'

// Um livro está visível para quem pede quando está publicado, ou quando quem
// pede é o próprio dono — o caso da prévia de rascunho (regra 11.4, critério 8.3).
// Visitante nunca enxerga rascunho, e admin da plataforma também não: rascunho é
// material não publicado de outra pessoa (nota da seção 5).
export function livroVisivelPara(livro: Livro, idDeQuemPede: string | null): boolean {
  return livro.publicado || livro.dono_id === idDeQuemPede
}

// Resolve a URL pública `/<handle>/<slug>` em livro e autor, já aplicando a
// visibilidade. Devolve null quando o handle não existe, quando o slug não
// existe naquela conta, ou quando o livro é rascunho de outra pessoa — os três
// casos dão o mesmo 404, de propósito: distingui-los revelaria o que existe.
export async function resolverLivroPublico(
  handle: string,
  slug: string,
  idDeQuemPede: string | null,
): Promise<{ livro: Livro; dono: Usuario } | null> {
  const dono = await buscarUsuarioPorHandle(handle)
  if (!dono) return null

  const livro = await buscarLivroPorDonoESlug(dono.id, slug)
  if (!livro || !livroVisivelPara(livro, idDeQuemPede)) return null

  return { livro, dono }
}

// Reduz um livro ao que pode sair do servidor. Os caminhos do Storage e o dono
// ficam de fora: o navegador só alcança PDF e capa pelas rotas de proxy (seção 4).
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
    tem_capa: Boolean(livro.capa_caminho),
  }
}

// O que a vitrine mostra do autor. Sem e-mail (critério 8.5).
export function toAutorPublico(usuario: Usuario): AutorPublico {
  return { handle: usuario.handle ?? '', nome: usuario.nome }
}

// Ordena livros do mais recente para o mais antigo (critério 8.5).
export function ordenarPorCriadoEmDesc(livros: Livro[]): Livro[] {
  return [...livros].sort((a, b) => b.criado_em.localeCompare(a.criado_em))
}

// Nome de arquivo amigável para o download: o título do livro, sem os caracteres
// que quebram cabeçalho HTTP ou nome de arquivo (critério 8.4).
export function nomeArquivoDownload(titulo: string): string {
  const limpo = titulo.replace(/[\\/:*?"<>|]/g, '').trim()
  return `${limpo || 'livro'}.pdf`
}

// O que o app de iPhone enxerga de um livro **da própria conta** (spec-ios
// critério A.4).
//
// É o público mais duas coisas que só o dono precisa: o aviso de remoção por
// denúncia (regra 11.12) e as URLs já montadas.
//
// **As URLs saem prontas daqui, com o `?v=`**, e é isso que resolve a pegadinha
// 11 do CLAUDE.md do lado do app (regra iOS 10.10): o endereço do PDF e o da
// capa não mudam quando o arquivo é substituído, então sem a versão o cache do
// `URLSession` continuaria entregando o arquivo antigo ao autor que acabou de
// trocá-lo. Montá-las no Swift seria repetir a regra num idioma onde ninguém
// vai lembrar dela.
export interface LivroDoAutor extends LivroPublico {
  removido_por_denuncia: boolean
  url: string
  pdf_url: string
  capa_url: string | null
}

export function toLivroDoAutor(livro: Livro, handle: string): LivroDoAutor {
  const base = `${urlDoSite()}/${handle}/${livro.slug}`
  const versao = versaoDosArquivos(livro)
  return {
    ...toLivroPublico(livro),
    removido_por_denuncia: livro.removido_por_denuncia,
    url: base,
    pdf_url: comVersao(`${urlDoSite()}/api/livros/${handle}/${livro.slug}/pdf`, versao),
    capa_url: livro.capa_caminho
      ? comVersao(`${urlDoSite()}/api/livros/${handle}/${livro.slug}/capa`, versao)
      : null,
  }
}
