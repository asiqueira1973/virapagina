// Diagnóstico contra o Firestore de VERDADE, para não adivinhar a causa de um
// erro que só acontece em produção. Só lê — não escreve nada.
//
//   node scripts/diagnostico.mjs <caminho-da-chave-json>
import { readFileSync } from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const chave = JSON.parse(readFileSync(process.argv[2], 'utf8'))
initializeApp({
  credential: cert({
    projectId: chave.project_id,
    clientEmail: chave.client_email,
    privateKey: chave.private_key,
  }),
})
const db = getFirestore()

function mostrarErro(erro) {
  console.log('   FALHOU:', erro.code ?? '', String(erro.message).split('\n')[0])
  const url = String(erro.message).match(/https:\/\/console\.[^\s)]+/)
  if (url) console.log('\n   >>> ABRA ISTO PARA CRIAR O ÍNDICE:\n   ' + url[0] + '\n')
}

console.log('--- contas ---')
const usuarios = await db.collection('usuarios').get()
usuarios.forEach((d) =>
  console.log(`   ${d.id} · ${d.data().email} · handle: ${d.data().handle} · plano: ${d.data().plano}`),
)
const dono = usuarios.empty ? 'nenhum' : usuarios.docs[0].id

console.log('--- consulta da tela /conta/livros (dono_id + orderBy criado_em) ---')
try {
  const r = await db.collection('livros').where('dono_id', '==', dono).orderBy('criado_em', 'desc').get()
  console.log('   OK —', r.size, 'livros')
} catch (erro) {
  mostrarErro(erro)
}

console.log('--- contagem por dono (limite do plano) ---')
try {
  const c = await db.collection('livros').where('dono_id', '==', dono).count().get()
  console.log('   OK —', c.data().count)
} catch (erro) {
  mostrarErro(erro)
}

console.log('--- busca por handle (vitrine) ---')
try {
  const h = await db.collection('usuarios').where('handle', '==', 'alexandre').limit(1).get()
  console.log('   OK —', h.size, 'encontrado(s)')
} catch (erro) {
  mostrarErro(erro)
}
