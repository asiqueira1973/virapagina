// GET /api/admin/contas — lista as contas da plataforma (spec seção 13.3,
// épico 8.7).
//
// Devolve plano, quantidade de livros e tráfego do mês contra a franquia.
// **Nunca devolve rascunho de ninguém**: rascunho é material não publicado de
// outra pessoa, e dar acesso a isso por conveniência de suporte é o começo do
// vazamento entre contas (nota da seção 5).
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admins'
import { contarLivrosDoDono, listarUsuarios, registrarAcaoAdmin } from '@/lib/firebase/firestore'
import { requireAdminPlataforma } from '@/lib/guards'
import { PLANOS, fracaoDaFranquia, limiteDeLivros } from '@/lib/planos'

export async function GET() {
  const guarda = await requireAdminPlataforma()
  if (!guarda.autorizado) return guarda.resposta

  try {
    const usuarios = await listarUsuarios()
    const contas = await Promise.all(
      usuarios.map(async (usuario) => ({
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        handle: usuario.handle,
        plano: usuario.plano,
        plano_rotulo: PLANOS[usuario.plano].rotulo,
        limite_livros: limiteDeLivros(usuario.plano),
        quantidade_livros: await contarLivrosDoDono(usuario.id),
        trafego_mes_bytes: usuario.trafego_mes_bytes,
        fracao_da_franquia: fracaoDaFranquia(usuario.plano, usuario.trafego_mes_bytes),
        // Conta do dono não pode ter o plano alterado (regra 11.13).
        eh_dono_da_plataforma: isAdminEmail(usuario.email),
        criado_em: usuario.criado_em,
      })),
    )

    await registrarAcaoAdmin({ admin_email: guarda.email, acao: 'consultou_conta' })
    return NextResponse.json({ contas })
  } catch (erro) {
    console.error('Falha ao listar contas:', erro)
    return NextResponse.json(
      { erro: 'Algo deu errado. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}
