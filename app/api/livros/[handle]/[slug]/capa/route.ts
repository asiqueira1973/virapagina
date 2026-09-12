// GET /api/livros/[handle]/[slug]/capa — proxy da capa guardada no Storage
// (spec seção 13.1). Mesma regra de visibilidade do PDF. Devolve 404 quando o
// livro ainda não tem capa gerada, que é estado previsto (regra 11.1).
//
// Mesma política de cache do PDF, e pelo mesmo motivo: substituir o arquivo
// regera a capa no mesmo caminho (critério 8.2), então a URL precisa do ?v= para
// deixar de apontar para a imagem antiga.
import { NextResponse } from 'next/server'
import { resolverLivroPublico } from '@/lib/books'
import { cabecalhosDeCache } from '@/lib/cache'
import { somarTrafego } from '@/lib/firebase/firestore'
import { baixarArquivo } from '@/lib/firebase/storage'
import { sessaoAtual } from '@/lib/guards'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string; slug: string }> },
) {
  const { handle, slug } = await params
  try {
    const sessao = await sessaoAtual()
    const resultado = await resolverLivroPublico(handle.toLowerCase(), slug, sessao?.id ?? null)

    const livro = resultado?.livro
    // Livro sem capa gerada é estado previsto (regra 11.1), e dá o mesmo 404 de
    // livro inexistente — não há nada a mostrar nos dois casos.
    if (!livro?.capa_caminho) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    const arquivo = await baixarArquivo(livro.capa_caminho)
    if (!arquivo) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    const cacheControl = cabecalhosDeCache({
      publicado: livro.publicado,
      versionada: new URL(request.url).searchParams.has('v'),
    })
    const etag = arquivo.versao ? `"${arquivo.versao}"` : null

    // Capa inalterada: 304, sem transmitir a imagem nem contar tráfego.
    if (etag && request.headers.get('if-none-match') === etag) {
      void arquivo.stream.cancel()
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': cacheControl },
      })
    }

    void somarTrafego(livro.dono_id, arquivo.tamanhoBytes ?? 0)

    const cabecalhos = new Headers({
      'Content-Type': 'image/png',
      'Cache-Control': cacheControl,
    })
    if (etag) cabecalhos.set('ETag', etag)

    return new Response(arquivo.stream, { headers: cabecalhos })
  } catch (erro) {
    console.error(`Falha ao transmitir a capa de ${handle}/${slug}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
