// GET /api/livros/[slug]/pdf — proxy do PDF guardado no Drive (spec seção 13).
// O navegador nunca recebe um link direto do Drive: o arquivo é transmitido por
// aqui, com a mesma regra de visibilidade dos metadados (404 para rascunho sem
// sessão de admin).
//
// Sem parâmetro, serve inline — é assim que o PDF.js lê o arquivo e que o botão
// "Imprimir" abre o PDF em nova aba. Com ?download=1, acrescenta o cabeçalho
// Content-Disposition com o título do livro como nome do arquivo (critério 8.4).
import { NextResponse } from 'next/server'
import { livroVisivelPara, nomeArquivoDownload } from '@/lib/books'
import { isAdminRequest } from '@/lib/google/auth'
import { downloadFileStream } from '@/lib/google/drive'
import { findBookBySlug } from '@/lib/google/sheets'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  try {
    const ehAdmin = await isAdminRequest()
    const livro = await findBookBySlug(slug, !ehAdmin)

    if (!livro || !livroVisivelPara(livro, ehAdmin) || !livro.arquivo_pdf_drive_id) {
      return NextResponse.json({ erro: 'Esse livro não está disponível.' }, { status: 404 })
    }

    const querDownload = new URL(request.url).searchParams.get('download') === '1'
    const stream = await downloadFileStream(livro.arquivo_pdf_drive_id)

    const cabecalhos = new Headers({
      'Content-Type': 'application/pdf',
      // O rascunho em prévia nunca pode ficar em cache de CDN — só o publicado.
      'Cache-Control':
        livro.publicado === 'sim'
          ? 'public, max-age=3600, stale-while-revalidate=86400'
          : 'private, no-store',
    })
    if (livro.arquivo_pdf_tamanho_bytes) {
      cabecalhos.set('Content-Length', String(livro.arquivo_pdf_tamanho_bytes))
    }
    if (querDownload) {
      // Aspas escapadas e nome sem caracteres perigosos: o nome vem do título,
      // que o admin digita livremente.
      const nome = nomeArquivoDownload(livro.titulo)
      cabecalhos.set(
        'Content-Disposition',
        `attachment; filename="${nome.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      )
    }

    return new Response(stream, { headers: cabecalhos })
  } catch (erro) {
    console.error(`Falha ao transmitir o PDF do livro ${slug}:`, erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
