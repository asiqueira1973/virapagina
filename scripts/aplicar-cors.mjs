// Aplica o cors.json ao bucket do Storage, sem depender do gcloud.
//
// O navegador envia os bytes do PDF direto para o Google, por uma URL de sessão
// assinada (spec seção 4). Sem CORS no bucket, todo upload falha **no
// navegador** — e falha do jeito pior: sem nenhum rastro no log do servidor,
// porque a recusa acontece entre o navegador e o Google, longe da aplicação.
//
// Usa a mesma chave de conta de serviço que a aplicação usa. Uso:
//
//   node scripts/aplicar-cors.mjs caminho/para/chave-conta-de-servico.json
//
// A chave é o arquivo que o console do Firebase baixa em
// Configurações do projeto → Contas de serviço → Gerar nova chave privada.
import { readFileSync } from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'

const caminhoDaChave = process.argv[2]
if (!caminhoDaChave) {
  console.error('Uso: node scripts/aplicar-cors.mjs <caminho-da-chave-json>')
  process.exit(1)
}

let chave
try {
  chave = JSON.parse(readFileSync(caminhoDaChave, 'utf8'))
} catch (erro) {
  console.error(`Não consegui ler a chave em ${caminhoDaChave}:`, erro.message)
  process.exit(1)
}

if (!chave.project_id || !chave.client_email || !chave.private_key) {
  console.error(
    'Esse JSON não parece uma chave de conta de serviço: faltam project_id, client_email ou private_key.',
  )
  process.exit(1)
}

const bucketAlvo = process.env.FIREBASE_STORAGE_BUCKET ?? `${chave.project_id}.firebasestorage.app`

// O cors.json carrega comentários (`_comentario`, `_sobre_as_origens`) para quem
// for lê-lo daqui a seis meses. A API do Storage recusa campo que não conhece,
// então só os quatro campos válidos são enviados.
const bruto = JSON.parse(readFileSync(new URL('../cors.json', import.meta.url), 'utf8'))
const configuracao = bruto.map((regra) => ({
  origin: regra.origin,
  method: regra.method,
  responseHeader: regra.responseHeader,
  maxAgeSeconds: regra.maxAgeSeconds,
}))

const app = initializeApp({
  credential: cert({
    projectId: chave.project_id,
    clientEmail: chave.client_email,
    privateKey: chave.private_key,
  }),
  storageBucket: bucketAlvo,
})

const bucket = getStorage(app).bucket()
await bucket.setCorsConfiguration(configuracao)

const [metadados] = await bucket.getMetadata()
console.log(`CORS aplicado em gs://${bucketAlvo}`)
for (const regra of metadados.cors ?? []) {
  console.log('  origens:', (regra.origin ?? []).join(', '))
  console.log('  métodos:', (regra.method ?? []).join(', '))
}
