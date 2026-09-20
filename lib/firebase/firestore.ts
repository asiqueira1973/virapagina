// Todo o acesso ao Firestore (spec seções 4, 7 e 13).
//
// Este é o único arquivo do projeto que conhece o formato das coleções. Se um dia
// isso virar Postgres, é só ele que muda — as telas e as rotas continuam iguais.
// Nada aqui roda no navegador (princípio 0.3).
//
// Duas armadilhas do Firestore que moram neste arquivo:
//   1. Não existe índice único. A unicidade de `handle` é garantida por uma
//      coleção dedicada gravada em transação, e a de `slug` por leitura antes da
//      escrita. Confiar no banco aqui é confiar em nada.
//   2. Não existe trigger. `atualizado_em` é reescrito por estas funções em toda
//      gravação; nenhuma delas pode ser contornada.
import { randomUUID } from 'node:crypto'
import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore'
import { isAdminEmail } from '@/lib/admins'
import { earlyAdopterAberto } from '@/lib/flags'
import { PLANO_ASSINANTE, PLANO_DO_DONO, PLANO_EARLY_ADOPTER, PLANO_PADRAO, planoValido } from '@/lib/planos'
import { proximoSlugLivre } from '@/lib/slug'
import { registrarEvento } from '@/lib/visao'
import type { AcaoAdmin, Assinatura, Livro, OrigemDaConta, Plano, Usuario } from '@/types/livro'
import { COLECOES, db } from './admin'

// Nomes que não podem virar handle porque colidem com rotas do produto (seção 7).
// `precos` fica reservado desde já, mesmo sem existir a tela, para o dia em que a
// cobrança entrar.
export const HANDLES_RESERVADOS = [
  'admin',
  'ajuda',
  'api',
  'app',
  'blog',
  'conta',
  'contato',
  'entrar',
  'favicon.ico',
  'l',
  'login',
  'precos',
  'privacidade',
  'sair',
  'sobre',
  'suporte',
  'termos',
  'www',
  '_next',
]

// Formato aceito para handle (critério 8.1).
export const FORMATO_DE_HANDLE = /^[a-z0-9-]{3,30}$/

// Converte um Timestamp do Firestore em string ISO. Documento gravado por outra
// via pode trazer string; nesse caso ela passa direto.
function paraIso(valor: unknown): string {
  if (valor instanceof Timestamp) return valor.toDate().toISOString()
  if (typeof valor === 'string') return valor
  return ''
}

// Mês corrente no formato `AAAA-MM`, usado para zerar o contador de tráfego.
function mesCorrente(): string {
  return new Date().toISOString().slice(0, 7)
}

// Remove chaves com valor `undefined` antes de gravar.
//
// O Firestore recusa `undefined` e derruba a escrita inteira. A alternativa
// seria `settings({ ignoreUndefinedProperties: true })`, mas ela só pode ser
// chamada uma vez e antes de qualquer uso da instância — coisa que nenhuma rota
// do Next.js consegue garantir (ver comentário em admin.ts). Limpar na origem
// resolve o mesmo problema sem depender de ordem de execução.
function semUndefined<T extends Record<string, unknown>>(dados: T): T {
  const limpo: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor !== undefined) limpo[chave] = valor
  }
  return limpo as T
}

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------

function paraUsuario(id: string, dados: DocumentData): Usuario {
  return {
    id,
    email: dados.email ?? '',
    nome: dados.nome ?? null,
    handle: dados.handle ?? null,
    // Plano desconhecido — de uma escrita manual no console, por exemplo — é
    // lido como gratuito: erra para menos, nunca para mais.
    plano: planoValido(dados.plano) ? dados.plano : PLANO_PADRAO,
    // Conta gravada antes do app não tem o campo, e a ausência é a verdade:
    // ela nasceu no site (regra iOS 10.1).
    origem: dados.origem === 'app' ? 'app' : 'web',
    assinatura: paraAssinatura(dados.assinatura),
    trafego_mes_bytes: typeof dados.trafego_mes_bytes === 'number' ? dados.trafego_mes_bytes : 0,
    trafego_mes_referencia: dados.trafego_mes_referencia ?? mesCorrente(),
    criado_em: paraIso(dados.criado_em),
    atualizado_em: paraIso(dados.atualizado_em),
  }
}

// Lê o objeto de assinatura gravado pelo servidor (spec-ios seção 4). Documento
// sem o campo — toda conta que nunca assinou — devolve null.
function paraAssinatura(dados: unknown): Assinatura | null {
  if (!dados || typeof dados !== 'object') return null
  const bruto = dados as DocumentData
  if (typeof bruto.transacao_original_id !== 'string') return null
  return {
    loja: 'app_store',
    produto_id: bruto.produto_id ?? '',
    transacao_original_id: bruto.transacao_original_id,
    status: bruto.status ?? 'expirada',
    expira_em: bruto.expira_em ? paraIso(bruto.expira_em) : null,
    ambiente: bruto.ambiente === 'sandbox' ? 'sandbox' : 'producao',
    atualizado_em: paraIso(bruto.atualizado_em),
  }
}

// Decide o plano de uma conta que está nascendo (regras 11.13, 11.14 e iOS 10.1).
//
// A ordem importa: a regra do dono vence a do early adopter. Um e-mail da
// plataforma nasce `ilimitado`, não `early_adopter` — senão a conta do dono
// ficaria com franquia de tráfego e apareceria como early adopter na tela de
// admin.
//
// A origem entra aqui e em nenhum outro lugar: conta criada **pelo app** nunca
// nasce early adopter, mesmo com a chave ligada (regra iOS 10.1). A promessa de
// livros ilimitados para sempre foi feita a quem chegou pelo site sem nada a
// pagar; estendê-la a quem chega por um app que existe para cobrar esvaziaria a
// assinatura antes da primeira compra.
//
// A regra do dono continua vencendo as duas: e-mail da plataforma é ilimitado
// venha de onde vier.
function planoDeContaNova(email: string, origem: OrigemDaConta) {
  if (isAdminEmail(email)) return PLANO_DO_DONO
  if (origem === 'app') return PLANO_PADRAO
  if (earlyAdopterAberto()) return PLANO_EARLY_ADOPTER
  return PLANO_PADRAO
}

// Garante que a conta existe e devolve o estado atual dela. É chamada em todo
// login (seção 6): cria a conta no primeiro acesso e, nos seguintes, corrige o
// que precisa ser corrigido.
//
// **Duas regras de plano, com comportamentos deliberadamente diferentes:**
//
//   - A 11.13 (contas do dono) é reaplicada **a cada login**. Se o e-mail for
//     acrescentado a ADMIN_ALLOWED_EMAILS depois, a conta se conserta sozinha; e
//     se alguém a rebaixar no console, o próximo login desfaz.
//   - A 11.14 (early adopter) é aplicada **uma vez, na criação, e nunca mais**.
//     É isso que faz o "vitalício" ser verdade nos dois sentidos: desligar a
//     chave não rebaixa quem já entrou, e religá-la não promove quem entrou
//     depois. Reaplicar esta regra no login seria o bug mais fácil de escrever
//     aqui, e o mais difícil de perceber.
//   - A origem (regra iOS 10.1) é gravada **só na criação** e nunca corrigida.
//     Quem criou a conta no site e depois baixou o app continua com origem 'web'
//     e com o plano que tem — inclusive early adopter ilimitado, sem paywall
//     (regra iOS 10.2). O plano é propriedade da conta, não do aparelho.
//   - O nome é **opcional**, e ausente não é o mesmo que nulo. A guarda do app
//     conhece o id e o e-mail de quem está pedindo, mas não o nome: ele só vem
//     no login. Passar `null` ali apagaria o nome da conta a cada requisição.
export async function garantirUsuario(params: {
  id: string
  email: string
  nome?: string | null
  origem?: OrigemDaConta
}): Promise<Usuario> {
  const referencia = db().collection(COLECOES.usuarios).doc(params.id)
  const documento = await referencia.get()
  const agora = Timestamp.now()
  const ehDono = isAdminEmail(params.email)

  if (!documento.exists) {
    const novo = {
      email: params.email,
      nome: params.nome ?? null,
      handle: null,
      plano: planoDeContaNova(params.email, params.origem ?? 'web'),
      origem: params.origem ?? 'web',
      assinatura: null,
      trafego_mes_bytes: 0,
      trafego_mes_referencia: mesCorrente(),
      criado_em: agora,
      atualizado_em: agora,
    }
    await referencia.set(semUndefined(novo))

    // Medir a conta nova aqui, e não no login, é o que mantém a contagem certa:
    // este ramo roda uma vez na vida da conta, enquanto `garantirUsuario` roda
    // em toda requisição (pegadinha 12 do CLAUDE.md).
    registrarEvento({
      nome: 'conta_criada',
      quem: params.email,
      tela: 'Entrar',
      descricao: 'criou a conta no primeiro acesso',
      propriedades: { origem: novo.origem, plano: novo.plano },
    })

    return paraUsuario(params.id, novo)
  }

  const atual = paraUsuario(params.id, documento.data() as DocumentData)

  // Só grava se algo mudou de verdade: login não precisa gerar escrita.
  //
  // Note o que NÃO está aqui: nada que mexa em `early_adopter`. O plano de quem
  // já existe só muda por ação do admin — ou pela regra do dono, logo abaixo.
  const correcoes: Record<string, unknown> = {}
  if (atual.email !== params.email) correcoes.email = params.email
  if (params.nome !== undefined && atual.nome !== params.nome) correcoes.nome = params.nome
  if (ehDono && atual.plano !== PLANO_DO_DONO) correcoes.plano = PLANO_DO_DONO

  if (Object.keys(correcoes).length === 0) return atual

  correcoes.atualizado_em = agora
  await referencia.update(semUndefined(correcoes))
  return { ...atual, ...(correcoes as Partial<Usuario>), atualizado_em: agora.toDate().toISOString() }
}

export async function buscarUsuarioPorId(id: string): Promise<Usuario | null> {
  const documento = await db().collection(COLECOES.usuarios).doc(id).get()
  if (!documento.exists) return null
  return paraUsuario(documento.id, documento.data() as DocumentData)
}

// Busca a conta dona de um handle. É o primeiro passo de toda URL pública.
export async function buscarUsuarioPorHandle(handle: string): Promise<Usuario | null> {
  const consulta = await db()
    .collection(COLECOES.usuarios)
    .where('handle', '==', handle.toLowerCase())
    .limit(1)
    .get()
  if (consulta.empty) return null
  const documento = consulta.docs[0]
  return paraUsuario(documento.id, documento.data() as DocumentData)
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const consulta = await db().collection(COLECOES.usuarios).orderBy('criado_em', 'desc').get()
  return consulta.docs.map((documento) => paraUsuario(documento.id, documento.data()))
}

// ---------------------------------------------------------------------------
// Handles
// ---------------------------------------------------------------------------

// Diz se um handle está livre para ser tomado. Reservado conta como ocupado.
export async function handleDisponivel(handle: string): Promise<boolean> {
  const normalizado = handle.toLowerCase()
  if (HANDLES_RESERVADOS.includes(normalizado)) return false
  const documento = await db().collection(COLECOES.handles).doc(normalizado).get()
  return !documento.exists
}

// Sugere um handle livre acrescentando -2, -3... ao pedido (critério 8.1).
export async function sugerirHandleLivre(base: string): Promise<string> {
  const normalizado = base.toLowerCase()
  const ocupados = new Set(HANDLES_RESERVADOS)
  // Busca só os candidatos que interessam, em vez da coleção inteira.
  const candidatos = [normalizado, ...Array.from({ length: 20 }, (_, i) => `${normalizado}-${i + 2}`)]
  const documentos = await db().getAll(
    ...candidatos.map((candidato) => db().collection(COLECOES.handles).doc(candidato)),
  )
  documentos.forEach((documento, indice) => {
    if (documento.exists) ocupados.add(candidatos[indice])
  })
  return proximoSlugLivre(normalizado, ocupados)
}

// Reserva o handle e o grava na conta, **numa transação**.
//
// É o ponto mais delicado do cadastro: sem transação, dois cadastros simultâneos
// escolhendo o mesmo handle vencem os dois, e um herda os links do outro. O
// `create` falha se o documento já existir, e é isso que faz um dos dois perder.
//
// Devolve false quando o handle já foi tomado — quem chama transforma isso na
// mensagem "Esse endereço já está em uso, escolha outro."
export async function reservarHandle(usuarioId: string, handle: string): Promise<boolean> {
  const normalizado = handle.toLowerCase()
  if (HANDLES_RESERVADOS.includes(normalizado)) return false

  const referenciaHandle = db().collection(COLECOES.handles).doc(normalizado)
  const referenciaUsuario = db().collection(COLECOES.usuarios).doc(usuarioId)

  try {
    await db().runTransaction(async (transacao) => {
      const existente = await transacao.get(referenciaHandle)
      if (existente.exists) throw new Error('handle-ocupado')

      const usuario = await transacao.get(referenciaUsuario)
      if (!usuario.exists) throw new Error('usuario-inexistente')
      // O handle é escolhido uma vez só (regra 11.10). Trocar é ação de admin.
      if (usuario.data()?.handle) throw new Error('handle-ja-definido')

      const agora = Timestamp.now()
      transacao.create(referenciaHandle, { usuario_id: usuarioId, criado_em: agora })
      transacao.update(referenciaUsuario, { handle: normalizado, atualizado_em: agora })
    })
    return true
  } catch {
    return false
  }
}

// Troca o handle de uma conta, liberando o antigo e reservando o novo na mesma
// transação (critério 8.7). Só o admin da plataforma chega aqui.
export async function trocarHandle(usuarioId: string, novoHandle: string): Promise<boolean> {
  const normalizado = novoHandle.toLowerCase()
  if (HANDLES_RESERVADOS.includes(normalizado)) return false

  const referenciaNovo = db().collection(COLECOES.handles).doc(normalizado)
  const referenciaUsuario = db().collection(COLECOES.usuarios).doc(usuarioId)

  try {
    await db().runTransaction(async (transacao) => {
      const ocupado = await transacao.get(referenciaNovo)
      if (ocupado.exists) throw new Error('handle-ocupado')

      const usuario = await transacao.get(referenciaUsuario)
      if (!usuario.exists) throw new Error('usuario-inexistente')

      const anterior = usuario.data()?.handle as string | null | undefined
      const agora = Timestamp.now()
      transacao.create(referenciaNovo, { usuario_id: usuarioId, criado_em: agora })
      if (anterior) {
        transacao.delete(db().collection(COLECOES.handles).doc(anterior))
      }
      transacao.update(referenciaUsuario, { handle: normalizado, atualizado_em: agora })
    })
    return true
  } catch {
    return false
  }
}

// Altera a faixa de uma conta (critério 8.7). Não toca em livro nenhum — mudar
// de plano nunca tira nada do ar (regra 11.9).
export async function alterarPlano(usuarioId: string, plano: Plano): Promise<void> {
  await db()
    .collection(COLECOES.usuarios)
    .doc(usuarioId)
    .update({ plano, atualizado_em: Timestamp.now() })
}

// ---------------------------------------------------------------------------
// Assinatura da App Store (spec-ios seções 4 e 5)
// ---------------------------------------------------------------------------

// Grava o estado da assinatura e o plano que ele implica, numa escrita só
// (regra iOS 10.5).
//
// Plano e assinatura andam juntos de propósito: gravá-los em duas escritas cria
// a janela em que a conta é `assinante` sem assinatura, ou o contrário — e é
// exatamente nessa janela que uma notificação de cancelamento chega.
//
// A conta volta para `gratuito` quando a assinatura deixa de valer, e **nenhum
// livro é tocado** (regra iOS 10.4): rebaixar não tira nada do ar.
//
// A regra do dono continua acima de tudo: e-mail da plataforma que assinar
// continua `ilimitado`, porque rebaixá-lo no fim da assinatura trancaria o dono
// para fora da própria plataforma.
export async function definirAssinatura(
  usuarioId: string,
  assinatura: Assinatura,
): Promise<Usuario | null> {
  const referencia = db().collection(COLECOES.usuarios).doc(usuarioId)
  const documento = await referencia.get()
  if (!documento.exists) return null

  const atual = paraUsuario(usuarioId, documento.data() as DocumentData)
  const vale = assinatura.status === 'ativa' || assinatura.status === 'em_atraso'
  const agora = Timestamp.now()

  const plano: Plano = isAdminEmail(atual.email)
    ? PLANO_DO_DONO
    : vale
      ? PLANO_ASSINANTE
      // Sem assinatura válida a conta volta à faixa que ela teria sem o app.
      // Quem é early adopter volta a ser early adopter — a promessa da regra
      // 11.14 não é gasta por ter assinado.
      : atual.plano === PLANO_ASSINANTE
        ? PLANO_PADRAO
        : atual.plano

  await referencia.update(
    semUndefined({
      plano,
      assinatura: {
        ...assinatura,
        expira_em: assinatura.expira_em ? Timestamp.fromDate(new Date(assinatura.expira_em)) : null,
        atualizado_em: agora,
      },
      atualizado_em: agora,
    }),
  )

  const atualizado = await referencia.get()
  return paraUsuario(usuarioId, atualizado.data() as DocumentData)
}

// Encontra a conta dona de uma assinatura pelo id original da transação.
//
// É o caminho de volta das notificações do servidor da Apple: elas chegam meses
// depois, sem sessão, sem app aberto, e a única coisa que identificam é a
// assinatura. O `originalTransactionId` é a chave estável dela — o id de cada
// renovação muda, este não.
//
// Consulta de igualdade num campo só: o Firestore indexa subcampo de mapa
// automaticamente, então esta não precisa entrar em `firestore.indexes.json`
// (pegadinha 8 do CLAUDE.md — a que precisa é `where` + `orderBy`).
export async function buscarUsuarioPorTransacaoOriginal(
  transacaoOriginalId: string,
): Promise<Usuario | null> {
  const consulta = await db()
    .collection(COLECOES.usuarios)
    .where('assinatura.transacao_original_id', '==', transacaoOriginalId)
    .limit(1)
    .get()
  if (consulta.empty) return null
  const documento = consulta.docs[0]
  return paraUsuario(documento.id, documento.data())
}

// Apaga a conta: o handle reservado e o documento (spec-ios seção 13).
//
// Os livros e os arquivos são apagados **antes**, por quem chama, um a um, pelo
// mesmo caminho da exclusão avulsa — assim a ordem da regra 11.6 (documento
// primeiro, arquivos depois) vale para cada livro e não é reinventada aqui.
//
// Liberar o handle é deliberado: a pessoa apagou a conta, e segurar o endereço
// dela para sempre seria guardar um dado de quem pediu para sumir.
export async function excluirUsuario(usuarioId: string): Promise<void> {
  const referencia = db().collection(COLECOES.usuarios).doc(usuarioId)
  const documento = await referencia.get()
  if (!documento.exists) return
  const handle = documento.data()?.handle as string | null | undefined
  if (handle) await db().collection(COLECOES.handles).doc(handle).delete()
  await referencia.delete()
}

// ---------------------------------------------------------------------------
// Tráfego (regra 11.11)
// ---------------------------------------------------------------------------

// Soma bytes servidos ao contador do mês da conta, zerando quando o mês virou.
//
// Quem chama NÃO deve esperar por esta função: ela é contabilidade, e uma falha
// aqui não pode impedir alguém de ler um livro. Por isso ela engole o próprio
// erro e apenas registra no log.
//
// Limitação assumida: o Firestore tolera cerca de uma escrita por segundo no
// mesmo documento. Um livro viral gera mais leituras do que isso, e parte da
// contagem se perde. Para uma válvula que existe para gerar conversa — não corte
// nem cobrança (regra 11.11) —, contagem aproximada basta.
export async function somarTrafego(usuarioId: string, bytes: number): Promise<void> {
  if (bytes <= 0) return
  try {
    const referencia = db().collection(COLECOES.usuarios).doc(usuarioId)
    const mes = mesCorrente()
    await db().runTransaction(async (transacao) => {
      const documento = await transacao.get(referencia)
      if (!documento.exists) return
      const referenciaAtual = documento.data()?.trafego_mes_referencia
      if (referenciaAtual !== mes) {
        // Virou o mês: o contador recomeça do zero com o que está sendo servido.
        transacao.update(referencia, {
          trafego_mes_bytes: bytes,
          trafego_mes_referencia: mes,
        })
      } else {
        transacao.update(referencia, { trafego_mes_bytes: FieldValue.increment(bytes) })
      }
    })
  } catch (erro) {
    console.error(`Falha ao contabilizar tráfego da conta ${usuarioId}:`, erro)
  }
}

// ---------------------------------------------------------------------------
// Livros
// ---------------------------------------------------------------------------

function paraLivro(id: string, dados: DocumentData): Livro {
  return {
    id,
    dono_id: dados.dono_id ?? '',
    titulo: dados.titulo ?? '',
    subtitulo: dados.subtitulo ?? null,
    slug: dados.slug ?? '',
    autor: dados.autor ?? '',
    descricao: dados.descricao ?? null,
    arquivo_pdf_caminho: dados.arquivo_pdf_caminho ?? '',
    arquivo_pdf_tamanho_bytes:
      typeof dados.arquivo_pdf_tamanho_bytes === 'number' ? dados.arquivo_pdf_tamanho_bytes : null,
    capa_caminho: dados.capa_caminho ?? null,
    total_paginas: typeof dados.total_paginas === 'number' ? dados.total_paginas : null,
    publicado: dados.publicado === true,
    removido_por_denuncia: dados.removido_por_denuncia === true,
    criado_em: paraIso(dados.criado_em),
    atualizado_em: paraIso(dados.atualizado_em),
  }
}

// Todos os livros de uma conta, do mais recente ao mais antigo. Alimenta o
// painel do autor, que mostra rascunho e publicado.
export async function listarLivrosDoDono(donoId: string): Promise<Livro[]> {
  const consulta = await db()
    .collection(COLECOES.livros)
    .where('dono_id', '==', donoId)
    .orderBy('criado_em', 'desc')
    .get()
  return consulta.docs.map((documento) => paraLivro(documento.id, documento.data()))
}

// Quantos livros a conta tem no total, rascunho e publicado. É esta contagem que
// o limite do plano usa (regra 11.8 e assunção 24.1).
export async function contarLivrosDoDono(donoId: string): Promise<number> {
  const consulta = await db()
    .collection(COLECOES.livros)
    .where('dono_id', '==', donoId)
    .count()
    .get()
  return consulta.data().count
}

export async function buscarLivroPorId(id: string): Promise<Livro | null> {
  const documento = await db().collection(COLECOES.livros).doc(id).get()
  if (!documento.exists) return null
  return paraLivro(documento.id, documento.data() as DocumentData)
}

// Busca um livro pela URL pública. O slug é único por dono, então a busca só faz
// sentido depois de resolver o handle (regra 11.3).
export async function buscarLivroPorDonoESlug(
  donoId: string,
  slug: string,
): Promise<Livro | null> {
  const consulta = await db()
    .collection(COLECOES.livros)
    .where('dono_id', '==', donoId)
    .where('slug', '==', slug)
    .limit(1)
    .get()
  if (consulta.empty) return null
  const documento = consulta.docs[0]
  return paraLivro(documento.id, documento.data())
}

// Diz se o slug já está em uso **dentro da conta**, ignorando opcionalmente o
// próprio livro que está sendo editado. Slug igual ao de outra conta é aceito
// sem reclamação: o namespace é por autor (critério 8.2).
export async function slugEmUsoNaConta(
  donoId: string,
  slug: string,
  exceptoId?: string,
): Promise<boolean> {
  const consulta = await db()
    .collection(COLECOES.livros)
    .where('dono_id', '==', donoId)
    .where('slug', '==', slug)
    .get()
  return consulta.docs.some((documento) => documento.id !== exceptoId)
}

// Sugere um slug livre na conta, acrescentando -2, -3... (critério 8.2).
export async function sugerirSlugLivreNaConta(
  donoId: string,
  base: string,
  exceptoId?: string,
): Promise<string> {
  const consulta = await db().collection(COLECOES.livros).where('dono_id', '==', donoId).get()
  const usados = consulta.docs
    .filter((documento) => documento.id !== exceptoId)
    .map((documento) => documento.data().slug as string)
  return proximoSlugLivre(base, usados)
}

// Cria o livro, sempre como rascunho (máquina de estado da seção 12).
export async function criarLivro(
  // O id vem de fora, da sessão de upload: o arquivo já nasceu em
  // `livros/<dono>/<id>/`, e o documento precisa ser o mesmo id para que a pasta
  // seja encontrável a partir dele. Enquanto esta função sorteava um id próprio,
  // documento e pasta eram dois ids diferentes — e substituir o PDF escrevia
  // numa pasta que ninguém lia (regra 11.6, critério 8.2).
  id: string,
  dados: Omit<Livro, 'id' | 'publicado' | 'removido_por_denuncia' | 'criado_em' | 'atualizado_em'>,
): Promise<Livro> {
  const agora = Timestamp.now()
  const documento = {
    ...dados,
    publicado: false,
    removido_por_denuncia: false,
    criado_em: agora,
    atualizado_em: agora,
  }
  await db().collection(COLECOES.livros).doc(id).set(semUndefined(documento))
  return paraLivro(id, documento)
}

// Atualiza um livro. Reescreve `atualizado_em` sempre — não existe trigger aqui,
// é esta função que mantém o campo em dia (seção 7).
export async function atualizarLivro(
  id: string,
  alteracoes: Partial<Omit<Livro, 'id' | 'dono_id' | 'criado_em'>>,
): Promise<Livro | null> {
  const referencia = db().collection(COLECOES.livros).doc(id)
  const documento = await referencia.get()
  if (!documento.exists) return null
  const agora = Timestamp.now()
  await referencia.update(semUndefined({ ...alteracoes, atualizado_em: agora }))
  const atualizado = await referencia.get()
  return paraLivro(id, atualizado.data() as DocumentData)
}

// Remove o documento do livro. Os arquivos do Storage são apagados **depois**,
// por quem chama, nessa ordem — assim nunca sobra metadado apontando para
// arquivo inexistente (regra 11.6).
export async function excluirLivro(id: string): Promise<void> {
  await db().collection(COLECOES.livros).doc(id).delete()
}

// ---------------------------------------------------------------------------
// Auditoria do admin da plataforma
// ---------------------------------------------------------------------------

// Registra uma ação do admin. Vale para o dono também: auditoria com exceção
// para o dono não é auditoria (seção 7).
export async function registrarAcaoAdmin(params: {
  admin_email: string
  acao: AcaoAdmin
  conta_alvo?: string | null
  livro_alvo?: string | null
  detalhe?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await db()
      .collection(COLECOES.acoesAdmin)
      .doc(randomUUID())
      .set(semUndefined({
        admin_email: params.admin_email,
        acao: params.acao,
        conta_alvo: params.conta_alvo ?? null,
        livro_alvo: params.livro_alvo ?? null,
        detalhe: params.detalhe ?? null,
        feito_em: Timestamp.now(),
      }))
  } catch (erro) {
    // Falhar a auditoria não pode desfazer a ação que já aconteceu.
    console.error('Falha ao registrar ação de admin:', erro)
  }
}
