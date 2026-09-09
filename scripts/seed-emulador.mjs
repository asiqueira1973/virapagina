// Popula o emulador do Firebase com uma conta e um livro publicado, para o
// desenvolvimento local ter o que mostrar.
//
// Roda SÓ contra o emulador: se as variáveis de emulador não estiverem
// definidas, ele para. Semear dados de teste num projeto de verdade é o tipo de
// engano que só se descobre quando alguém abre a vitrine e vê "Livro de teste".
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Este script só roda contra o emulador. Defina FIRESTORE_EMULATOR_HOST.')
  process.exit(1)
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'virapagina-local'
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`
const app = initializeApp({ projectId, storageBucket })
const db = getFirestore(app)
const bucket = getStorage(app).bucket()

const caminhoDoPdf = process.argv[2]
if (!caminhoDoPdf) {
  console.error('Uso: node scripts/seed-emulador.mjs <caminho-do-pdf>')
  process.exit(1)
}

const donoId = 'seed-alexandre'
const handle = 'alexandre'
const livroId = randomUUID()
const agora = Timestamp.now()

// A conta do dono da plataforma nasce ilimitada (regra 11.13) — aqui isso é
// escrito à mão porque o script não passa pelo login.
await db.collection('usuarios').doc(donoId).set({
  email: 'alexandre@dablab.com.br',
  nome: 'Alexandre Siqueira',
  handle,
  plano: 'ilimitado',
  trafego_mes_bytes: 0,
  trafego_mes_referencia: new Date().toISOString().slice(0, 7),
  criado_em: agora,
  atualizado_em: agora,
})
await db.collection('handles').doc(handle).set({ usuario_id: donoId, criado_em: agora })

const pdf = readFileSync(caminhoDoPdf)
await bucket
  .file(`livros/${donoId}/${livroId}/original.pdf`)
  .save(pdf, { contentType: 'application/pdf', resumable: false })

await db.collection('livros').doc(livroId).set({
  dono_id: donoId,
  titulo: 'Conceitos de Tecnologia para Pessoas Executivas',
  subtitulo: 'e Não Técnicas',
  slug: 'conceitos-de-tecnologia',
  autor: 'Alexandre Siqueira',
  descricao: 'O guia que traduz a tecnologia do dia a dia para quem decide sem escrever código.',
  arquivo_pdf_caminho: `livros/${donoId}/${livroId}/original.pdf`,
  arquivo_pdf_tamanho_bytes: pdf.length,
  capa_caminho: null,
  total_paginas: null,
  publicado: true,
  removido_por_denuncia: false,
  criado_em: agora,
  atualizado_em: agora,
})

console.log(`semeado: /${handle}/conceitos-de-tecnologia (livro ${livroId}, ${pdf.length} bytes)`)
