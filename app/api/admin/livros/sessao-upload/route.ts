// POST /api/admin/livros/sessao-upload — abre uma sessão de upload resumável no
// Google Drive e devolve a URL temporária dela para o navegador enviar o PDF.
//
// Rota adicional em relação à lista da seção 13, criada junto com a decisão
// aprovada de usar upload resumável (ver comentário em lib/google/drive.ts):
// funções serverless da Vercel aceitam ~4,5 MB de corpo, o que impediria a regra
// 11.2 (PDF de até 100 MB) se os bytes passassem pela rota de API.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/google/auth'
import { createResumableUploadSession } from '@/lib/google/drive'

// Teto de 100 MB da regra 11.2, repetido aqui no servidor: a checagem do cliente
// (critério 8.2) é a que dá a mensagem ao usuário, mas não pode ser a única.
const TAMANHO_MAXIMO_BYTES = 100 * 1024 * 1024

export async function POST(request: Request) {
  // Primeira linha, sem exceção: nada é feito no Drive antes disso (seção 6).
  const guarda = await requireAdmin()
  if (!guarda.autorizado) return guarda.resposta

  try {
    const corpo = await request.json()
    const nome = typeof corpo?.nome === 'string' ? corpo.nome.trim() : ''
    const mimeType = typeof corpo?.mimeType === 'string' ? corpo.mimeType : ''
    const tamanhoBytes = Number(corpo?.tamanhoBytes)

    if (!nome) {
      return NextResponse.json({ erro: 'Envie um arquivo PDF.' }, { status: 400 })
    }
    if (mimeType !== 'application/pdf') {
      return NextResponse.json({ erro: 'Envie um arquivo PDF.' }, { status: 400 })
    }
    if (!Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0) {
      return NextResponse.json({ erro: 'Envie um arquivo PDF.' }, { status: 400 })
    }
    if (tamanhoBytes > TAMANHO_MAXIMO_BYTES) {
      return NextResponse.json(
        { erro: 'Arquivo muito grande (máximo 100 MB).' },
        { status: 400 },
      )
    }

    // A origem precisa ir na abertura da sessão para o Google devolver uma URL
    // que o navegador consegue usar (CORS).
    const origin = new URL(request.url).origin
    const uploadUrl = await createResumableUploadSession({
      nome,
      mimeType,
      tamanhoBytes,
      origin,
    })

    return NextResponse.json({ uploadUrl })
  } catch (erro) {
    console.error('Falha ao abrir sessão de upload no Drive:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
