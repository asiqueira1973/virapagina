// As três guardas de autorização (spec seção 6).
//
// Elas substituem o RLS que existiria num banco relacional. **Toda** rota chama
// a sua guarda como primeira linha, antes de qualquer leitura ou escrita no
// Firestore ou no Storage. Sem isso, um produto multi-tenant vaza dado entre
// contas — o único erro deste produto que não tem conserto (seções 20 e 23).
//
// Este arquivo é de Node, não do Edge: ele toca o Firestore. O middleware usa a
// configuração magra de `lib/auth.ts`.
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admins'
import { auth } from '@/lib/auth'
import { buscarLivroPorId, garantirUsuario } from '@/lib/firebase/firestore'
import type { Livro, Usuario } from '@/types/livro'

// Resultado de uma guarda: ou o que ela liberou, ou a resposta HTTP pronta que a
// rota deve devolver sem tocar em nada.
export type Resultado<T> =
  | ({ autorizado: true } & T)
  | { autorizado: false; resposta: NextResponse }

function erro(status: number, mensagem: string): { autorizado: false; resposta: NextResponse } {
  return { autorizado: false, resposta: NextResponse.json({ erro: mensagem }, { status }) }
}

// Guarda de toda rota sob /api/conta/*.
//
// Devolve 401 sem sessão. Com sessão, garante que a conta existe — é aqui que a
// conta nasce no primeiro acesso e que a regra 11.13 (contas do dono são
// ilimitadas) é reaplicada a cada login.
//
// Devolve 409 quando a conta ainda não escolheu handle: sem handle não existe
// URL pública, logo não existe produto, e o frontend usa esse código para mandar
// a pessoa à tela de escolha (critério 8.1). Passe `exigeHandle: false` na única
// rota que precisa rodar antes disso — a que define o handle.
export async function requireAutor(
  opcoes: { exigeHandle?: boolean } = {},
): Promise<Resultado<{ usuario: Usuario }>> {
  const sessao = await auth()
  const id = sessao?.user?.id
  const email = sessao?.user?.email

  if (!id || !email) return erro(401, 'Não autenticado.')

  const usuario = await garantirUsuario({
    id,
    email,
    nome: sessao?.user?.name ?? null,
  })

  if (opcoes.exigeHandle !== false && !usuario.handle) {
    return {
      autorizado: false,
      resposta: NextResponse.json(
        { erro: 'Escolha seu endereço antes de continuar.', destino: '/conta/handle' },
        { status: 409 },
      ),
    }
  }

  return { autorizado: true, usuario }
}

// Guarda de toda rota que toca um livro específico.
//
// Roda a guarda acima e depois compara `dono_id` com a sessão. Livro de outra
// conta devolve **404, não 403**: responder "existe, mas não é seu" confirma a
// existência de um rascunho alheio, que é exatamente o que não se pode revelar.
export async function requireDonoDoLivro(
  livroId: string,
): Promise<Resultado<{ usuario: Usuario; livro: Livro }>> {
  const guarda = await requireAutor()
  if (!guarda.autorizado) return guarda

  const livro = await buscarLivroPorId(livroId)
  if (!livro || livro.dono_id !== guarda.usuario.id) {
    return erro(404, 'Livro não encontrado.')
  }

  return { autorizado: true, usuario: guarda.usuario, livro }
}

// Guarda de toda rota sob /api/admin/*. Admin é papel de plataforma, não de
// conta (seção 5): a lista é a variável ADMIN_ALLOWED_EMAILS.
export async function requireAdminPlataforma(): Promise<Resultado<{ email: string }>> {
  const sessao = await auth()
  const email = sessao?.user?.email

  if (!email) return erro(401, 'Não autenticado.')
  if (!isAdminEmail(email)) return erro(403, 'Sem acesso ao painel da plataforma.')

  return { autorizado: true, email }
}

// A irmã sem erro, para as rotas públicas: diz quem está pedindo, sem barrar
// ninguém. É ela que libera a prévia de rascunho ao próprio dono mantendo o 404
// para todo o resto do mundo (seção 6).
export async function sessaoAtual(): Promise<{ id: string; email: string } | null> {
  const sessao = await auth()
  const id = sessao?.user?.id
  const email = sessao?.user?.email
  if (!id || !email) return null
  return { id, email }
}
