// GET /api/livros/[handle]/[slug]/pdf — proxy do PDF guardado no Storage
// (spec seção 13.1).
//
// O navegador nunca recebe uma URL do Storage: o arquivo é transmitido por aqui.
// É isso que permite tirar um livro do ar de verdade, que impede um link vazado
// de sobreviver ao despublicar, e que torna possível medir o tráfego por conta.
//
// Sem parâmetro, serve inline — é assim que o PDF.js lê o arquivo e que o botão
// "Imprimir" abre o PDF em nova aba. Com ?download=1, acrescenta o
// Content-Disposition com o título do livro como nome (critério 8.4).
import { NextResponse } from 'next/server'
import { nomeArquivoDownload, resolverLivroPublico } from '@/lib/books'
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
    if (!livro?.arquivo_pdf_caminho) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    const arquivo = await baixarArquivo(livro.arquivo_pdf_caminho)
    if (!arquivo) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    // Contabilidade da válvula de tráfego (regra 11.11). Deliberadamente sem
    // await: uma falha na contagem não pode impedir alguém de ler um livro.
    void somarTrafego(livro.dono_id, arquivo.tamanhoBytes ?? 0)

    const cabecalhos = new Headers({
      'Content-Type': 'application/pdf',
      // Rascunho em prévia nunca pode ficar em cache de CDN — só o publicado.
      'Cache-Control': livro.publicado
        ? 'public, max-age=3600, stale-while-revalidate=86400'
        : 'private, no-store',
    })
    if (arquivo.tamanhoBytes) cabecalhos.set('Content-Length', String(arquivo.tamanhoBytes))

    if (new URL(request.url).searchParams.get('download') === '1') {
      // O nome vem do título, que o autor digita livremente: as aspas são
      // escapadas e os caracteres perigosos, removidos.
      const nome = nomeArquivoDownload(livro.titulo)
      cabecalhos.set(
        'Content-Disposition',
        `attachment; filename="${nome.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      )
    }

    return new Response(arquivo.stream, { headers: cabecalhos })
  } catch (erro) {
    console.error(`Falha ao transmitir o PDF de ${handle}/${slug}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
