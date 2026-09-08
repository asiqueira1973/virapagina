// GET /api/admin/livros/slug-disponivel?slug=...&exceto=... — diz se um slug está
// livre e, se não estiver, sugere o próximo disponível (-2, -3...).
//
// Rota adicional em relação à lista da seção 13. O critério 8.2 exige que a
// rejeição de slug duplicado aconteça no servidor, e ela continua acontecendo no
// POST/PUT; esta rota só antecipa a mesma checagem para o formulário avisar antes
// de o admin subir um PDF que seria descartado.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/google/auth'
import { slugEmUso, sugerirSlugDisponivel } from '@/lib/google/sheets'
import { slugValido } from '@/lib/slug'

export async function GET(request: Request) {
  const guarda = await requireAdmin()
  if (!guarda.autorizado) return guarda.resposta

  try {
    const parametros = new URL(request.url).searchParams
    const slug = (parametros.get('slug') ?? '').trim()
    const exceto = parametros.get('exceto') ?? undefined

    if (!slug || !slugValido(slug)) {
      return NextResponse.json({ valido: false, disponivel: false, sugestao: null })
    }

    const emUso = await slugEmUso(slug, exceto)
    return NextResponse.json({
      valido: true,
      disponivel: !emUso,
      sugestao: emUso ? await sugerirSlugDisponivel(slug, exceto) : null,
    })
  } catch (erro) {
    console.error('Falha ao checar disponibilidade de slug:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
