// POST /api/rotinas/avisar-trafego — rotina diária da válvula de tráfego
// (spec seção 13.4, regra 11.11).
//
// **Avisa, nunca corta.** Não bloqueia leitura, não despublica, não cobra: só
// levanta a mão para gerar conversa antes de a fatura do Google virar problema.
// Conta `ilimitado` não tem franquia e nunca aparece aqui (regra 11.13).
//
// Protegida por CRON_SECRET: sem isso, qualquer um poderia varrer o uso de todas
// as contas da plataforma.
import { NextResponse } from 'next/server'
import { listarUsuarios } from '@/lib/firebase/firestore'
import { LIMIAR_AVISO_AUTOR, LIMIAR_AVISO_PLATAFORMA, fracaoDaFranquia } from '@/lib/planos'

export async function POST(request: Request) {
  const segredo = process.env.CRON_SECRET
  const autorizacao = request.headers.get('authorization')
  if (!segredo || autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const usuarios = await listarUsuarios()
    const avisarAutor: string[] = []
    const avisarPlataforma: string[] = []

    for (const usuario of usuarios) {
      const fracao = fracaoDaFranquia(usuario.plano, usuario.trafego_mes_bytes)
      // null = plano sem franquia (regra 11.13). Nunca dispara aviso.
      if (fracao === null) continue
      if (fracao >= LIMIAR_AVISO_PLATAFORMA) avisarPlataforma.push(usuario.email)
      else if (fracao >= LIMIAR_AVISO_AUTOR) avisarAutor.push(usuario.email)
    }

    // O envio de e-mail ainda não existe: não há provedor configurado no v3.
    // Por ora a rotina registra no log e a tela de admin destaca as contas acima
    // de 80% — que é onde o dono realmente olha. Ver divergências na
    // documentação técnica.
    if (avisarAutor.length > 0) {
      console.warn('[trafego] contas acima de 80% da franquia:', avisarAutor.join(', '))
    }
    if (avisarPlataforma.length > 0) {
      console.warn('[trafego] contas que estouraram a franquia:', avisarPlataforma.join(', '))
    }

    return NextResponse.json({
      contas_avaliadas: usuarios.length,
      acima_de_80: avisarAutor.length,
      acima_de_100: avisarPlataforma.length,
    })
  } catch (erro) {
    console.error('Falha na rotina de aviso de tráfego:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
