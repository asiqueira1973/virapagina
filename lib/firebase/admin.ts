// Inicialização do Firebase Admin SDK (spec seção 4).
//
// Este é o único lugar do projeto que cria a conexão com o Firestore e com o
// Storage. Nada aqui pode ser importado por componente de cliente: a chave da
// conta de serviço dá acesso total aos dados e aos arquivos (princípio 0.3 e
// seção 20), e um import errado a colocaria no pacote do navegador.
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

// Devolve o valor de uma variável obrigatória ou falha alto, com o nome da
// variável no log de servidor — nunca na tela do usuário (seção 20). A leitura é
// sob demanda, dentro de função: no topo do módulo ela quebraria o `next build`,
// que abre cada rota para coletar configuração e não tem segredo de runtime.
function requireEnv(nome: string): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`)
  return valor
}

// Diz se estamos falando com o emulador local em vez do Firebase de verdade.
// O SDK detecta isso sozinho pelas variáveis FIRESTORE_EMULATOR_HOST e
// FIREBASE_STORAGE_EMULATOR_HOST; aqui só evitamos exigir credencial real, que
// o emulador não usa.
function usandoEmulador(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST)
}

let aplicativo: App | null = null

// Cria o aplicativo do Admin SDK uma vez só. O `getApps()` existe porque o
// Next.js recarrega módulos em desenvolvimento, e inicializar duas vezes com o
// mesmo nome é erro.
function getApp(): App {
  if (aplicativo) return aplicativo
  const existentes = getApps()
  if (existentes.length > 0) {
    aplicativo = existentes[0]
    return aplicativo
  }

  const projectId = requireEnv('FIREBASE_PROJECT_ID')
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET

  aplicativo = usandoEmulador()
    ? initializeApp({ projectId, storageBucket })
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
          // A chave privada vem da Vercel com "\n" escapado; o SDK exige
          // quebras de linha reais.
          privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
        }),
        storageBucket: requireEnv('FIREBASE_STORAGE_BUCKET'),
      })

  return aplicativo
}

// Cliente do Firestore. O SDK devolve sempre a mesma instância por aplicativo.
//
// Não chamamos `settings()` aqui de propósito. Ele só aceita ser chamado uma vez
// e **antes de qualquer outro uso** da instância — e no Next.js cada rota tem o
// seu próprio grafo de módulos, então nenhuma delas consegue saber se foi a
// primeira. Na prática a segunda rota a rodar derrubava a requisição com
// "Firestore has already been initialized", e a falha dependia da ordem em que
// as páginas eram abertas. Em vez de coordenar isso, as escritas limpam os
// campos `undefined` na origem (ver `semUndefined` em firestore.ts).
export function db(): Firestore {
  return getFirestore(getApp())
}

// Bucket de arquivos do projeto.
export function bucket() {
  return getStorage(getApp()).bucket()
}

// Nomes das coleções, num lugar só. Em português, como manda a seção 18.
export const COLECOES = {
  usuarios: 'usuarios',
  handles: 'handles',
  livros: 'livros',
  acoesAdmin: 'acoes_admin',
} as const
