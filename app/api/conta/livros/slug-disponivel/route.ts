// GET /api/conta/livros/slug-disponivel — diz se um slug está livre **dentro da
// conta** e sugere o próximo disponível (spec seção 13.2, critério 8.2).
//
// O critério exige que a rejeição de slug duplicado aconteça no servidor, e ela
// continua acontecendo no POST e no PUT. Esta rota só antecipa a mesma checagem,
// para o formulário avisar antes de o autor subir um PDF que seria descartado.
import { NextResponse } from 'next/server'
import { slugEmUsoNaConta, sugerirSlugLivreNaConta } from '@/lib/firebase/firestore'
import { requireAutor } from '@/lib/guards'
import { slugValido } from '@/lib/slug'

export async function GET(request: Request) {
  const guarda = await requireAutor()
  if (!guarda.autorizado) return guarda.resposta

  try {
    const parametros = new URL(request.url).searchParams
    const slug = (parametros.get('slug') ?? '').trim()
    const exceto = parametros.get('exceto') ?? undefined

    if (!slug || !slugValido(slug)) {
      return NextResponse.json({ valido: false, disponivel: false, sugestao: null })
    }

    const emUso = await slugEmUsoNaConta(guarda.usuario.id, slug, exceto)
    return NextResponse.json({
      valido: true,
      disponivel: !emUso,
      sugestao: emUso ? await sugerirSlugLivreNaConta(guarda.usuario.id, slug, exceto) : null,
    })
  } catch (erro) {
    console.error('Falha ao checar disponibilidade de slug:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
