// A visão que o app de iPhone tem da conta (spec-ios seção 8).
//
// Existe para que as três rotas que devolvem "a conta" — entrar, ler a conta e
// confirmar a assinatura — devolvam **exatamente o mesmo objeto**. Enquanto cada
// uma montava o seu, o app precisava saber qual campo vinha de onde.
//
// O que não está aqui é tão deliberado quanto o que está: nada de `origem`,
// nada de caminho de Storage, nada de contador de tráfego. O app não decide com
// esses dados, e o que não sai do servidor não vaza.
import { contarLivrosDoDono } from '@/lib/firebase/firestore'
import { PLANOS, limiteDeLivros } from '@/lib/planos'
import type { Usuario } from '@/types/livro'

export interface ContaDoApp {
  id: string
  email: string
  nome: string | null
  handle: string | null
  plano: string
  rotulo_do_plano: string
  uso: { livros: number; limite: number | null }
  assinatura: { status: string; expira_em: string | null } | null
}

export async function contaParaOApp(usuario: Usuario): Promise<ContaDoApp> {
  // Conta sem handle ainda não tem livro nenhum, e a consulta custaria uma ida
  // ao Firestore para devolver zero.
  const livros = usuario.handle ? await contarLivrosDoDono(usuario.id) : 0

  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    handle: usuario.handle,
    plano: usuario.plano,
    rotulo_do_plano: PLANOS[usuario.plano].rotulo,
    uso: { livros, limite: limiteDeLivros(usuario.plano) },
    assinatura: usuario.assinatura
      ? { status: usuario.assinatura.status, expira_em: usuario.assinatura.expira_em }
      : null,
  }
}
