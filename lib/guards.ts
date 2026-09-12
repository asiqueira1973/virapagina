// As três guardas de autorização (spec seção 6).
//
// Elas substituem o RLS que existiria num banco relacional. **Toda** rota chama
// a sua guarda como primeira linha, antes de qualquer leitura ou escrita no
// Firestore ou no Storage. Sem isso, um produto multi-tenant vaza dado entre
// contas — o único erro deste produto que não tem conserto (seções 20 e 23).
//
// Este arquivo é de Node, não do Edge: ele toca o Firestore. O middleware usa a
// configuração magra de `lib/auth.ts`.
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admins'
import { tokenDoCabecalho, verificarTokenDoApp } from '@/lib/app-auth'
import { auth } from '@/lib/auth'
import { buscarLivroPorId, garantirUsuario } from '@/lib/firebase/firestore'
import type { Livro, OrigemDaConta, Usuario } from '@/types/livro'

// Resultado de uma guarda: ou o que ela liberou, ou a resposta HTTP pronta que a
// rota deve devolver sem tocar em nada.
export type Resultado<T> =
  | ({ autorizado: true } & T)
  | { autorizado: false; resposta: NextResponse }

function erro(status: number, mensagem: string): { autorizado: false; resposta: NextResponse } {
  return { autorizado: false, resposta: NextResponse.json({ erro: mensagem }, { status }) }
}

// Quem está do outro lado: o navegador, com cookie de sessão, ou o app de
// iPhone, com `Authorization: Bearer` (spec-ios seção 3, critério A.2).
//
// Fica aqui dentro, e não numa mudança de assinatura das guardas, para que
// **nenhuma rota existente precise ser reescrita** — a rota continua chamando
// `requireAutor()` sem argumento e passa a atender os dois clientes.
//
// Ordem deliberada: o cabeçalho vem primeiro porque é a resposta barata, e um
// pedido com bearer **nunca** cai no cookie, mesmo que o bearer seja inválido.
// Cair seria autenticar por uma credencial que não foi a apresentada — e faria
// um token vencido do app virar sessão de outra conta aberta no mesmo Safari.
async function identificarPedido(): Promise<{
  id: string
  email: string
  // Ausente quando quem pede é o app: o bearer não carrega nome, e `null` não
  // serviria — apagaria o nome da conta a cada requisição.
  nome?: string | null
  origem: OrigemDaConta
} | null> {
  // `headers()` só existe dentro de uma requisição. Fora dela — num teste de
  // unidade que chama a guarda direto — a ausência de bearer é a resposta certa.
  let autorizacao: string | null = null
  try {
    autorizacao = (await headers()).get('authorization')
  } catch {
    autorizacao = null
  }

  const token = tokenDoCabecalho(autorizacao)
  if (token) {
    const dono = verificarTokenDoApp(token)
    return dono ? { id: dono.id, email: dono.email, origem: 'app' } : null
  }

  const sessao = await auth()
  const id = sessao?.user?.id
  const email = sessao?.user?.email
  if (!id || !email) return null
  // O nome sai da sessão só no caminho do navegador; o do app não o carrega.
  return { id, email, nome: sessao?.user?.name ?? null, origem: 'web' }
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
  const pedido = await identificarPedido()
  if (!pedido) return erro(401, 'Não autenticado.')

  // Sem `origem`: esta função roda em toda requisição, e a origem só pode ser
  // decidida na **criação** da conta (regra iOS 10.1). Quem cria conta pelo app é
  // a rota de sessão, que passa a origem explicitamente. Um bearer que chegue
  // aqui sem conta é token de conta apagada — recriá-la como 'web' erra dando
  // menos, que é o lado certo de errar.
  const usuario = await garantirUsuario({
    id: pedido.id,
    email: pedido.email,
    nome: pedido.nome,
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
  // Vale para os dois clientes: é ela que libera a prévia de rascunho, e o app
  // precisa da prévia tanto quanto o navegador (critério C.6). Sem isso, o
  // leitor do app receberia 404 no próprio rascunho do dono.
  const pedido = await identificarPedido()
  if (!pedido) return null
  return { id: pedido.id, email: pedido.email }
}
