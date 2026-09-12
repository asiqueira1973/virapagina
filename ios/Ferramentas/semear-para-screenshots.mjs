// Semeia o emulador com uma conta e os livros de exemplo dos screenshots.
//
// Fora do repositório de propósito: é bastidor de captura de tela, não produto.
// Roda só contra o emulador — as variáveis de emulador são obrigatórias.
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { initializeApp } from 'firebase-admin/app'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Só roda contra o emulador.')
  process.exit(1)
}

const quantos = Number(process.argv[2] ?? 4)

const projectId = 'virapagina-local'
const app = initializeApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` })
const db = getFirestore(app)
const bucket = getStorage(app).bucket()

const donoId = 'screenshots-alexandre'
const email = 'alexandre@dablab.com.br'
const handle = 'alexandre'
const agora = Timestamp.now()

// A conta nasce como a de quem baixa o app: gratuita, cinco livros (regra iOS
// 10.1). É isso que faz o paywall aparecer de verdade no screenshot.
await db.collection('usuarios').doc(donoId).set({
  email,
  nome: 'Alexandre Siqueira',
  handle,
  plano: 'gratuito',
  origem: 'app',
  assinatura: null,
  trafego_mes_bytes: 0,
  trafego_mes_referencia: new Date().toISOString().slice(0, 7),
  criado_em: agora,
  atualizado_em: agora,
})
await db.collection('handles').doc(handle).set({ usuario_id: donoId, criado_em: agora })

const livros = [
  { arquivo: 'conceitos-de-tecnologia', titulo: 'Conceitos de Tecnologia', subtitulo: 'para quem decide sem escrever código', autor: 'Alexandre Siqueira', paginas: 12, publicado: true },
  { arquivo: 'luz-de-inverno', titulo: 'Luz de Inverno', subtitulo: 'fotografias, 2019–2026', autor: 'Alexandre Siqueira', paginas: 10, publicado: true },
  { arquivo: 'rua-27', titulo: 'Rua 27', subtitulo: 'uma zine sobre andar a pé', autor: 'Coletivo Quadra', paginas: 8, publicado: true },
  { arquivo: 'relatorio-2026', titulo: 'Relatório Anual', subtitulo: 'resultados e caminhos de 2026', autor: 'Dab Lab', paginas: 14, publicado: false },
  { arquivo: 'cerrado', titulo: 'Cerrado', subtitulo: 'o que floresce depois do fogo', autor: 'Marina Alencar', paginas: 11, publicado: true },
]

const pasta = path.dirname(new URL(import.meta.url).pathname)

// Limpa o que ficou de uma execução anterior, para não acumular livro repetido.
for (const doc of (await db.collection('livros').where('dono_id', '==', donoId).get()).docs) {
  await doc.ref.delete()
}

let indice = 0
for (const livro of livros.slice(0, quantos)) {
  indice += 1
  const livroId = `screenshot-${livro.arquivo}`
  const pdf = readFileSync(path.join(pasta, `${livro.arquivo}.pdf`))
  const capa = readFileSync(path.join(pasta, `${livro.arquivo}-capa.png`))

  await bucket.file(`livros/${donoId}/${livroId}/original.pdf`)
    .save(pdf, { contentType: 'application/pdf', resumable: false })
  await bucket.file(`livros/${donoId}/${livroId}/capa.png`)
    .save(capa, { contentType: 'image/png', resumable: false })

  // Datas escalonadas para a lista não mostrar cinco livros do mesmo minuto.
  const quando = Timestamp.fromMillis(Date.now() - indice * 36 * 60 * 60 * 1000)

  await db.collection('livros').doc(livroId).set({
    dono_id: donoId,
    titulo: livro.titulo,
    subtitulo: livro.subtitulo,
    slug: livro.arquivo,
    autor: livro.autor,
    descricao: null,
    arquivo_pdf_caminho: `livros/${donoId}/${livroId}/original.pdf`,
    arquivo_pdf_tamanho_bytes: pdf.length,
    capa_caminho: `livros/${donoId}/${livroId}/capa.png`,
    total_paginas: livro.paginas,
    publicado: livro.publicado,
    removido_por_denuncia: false,
    criado_em: quando,
    atualizado_em: quando,
  })
  console.log(`semeado ${livro.titulo}`)
}

// O token do app, assinado igual ao `lib/app-auth.ts`: HS256, o mesmo segredo do
// servidor local, 30 dias.
const segredo = 'desenvolvimento-local-nao-usar-em-producao'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const agoraSeg = Math.floor(Date.now() / 1000)
const cabecalho = b64({ alg: 'HS256', typ: 'JWT' })
const corpo = b64({
  iss: 'virapagina',
  aud: 'virapagina-ios',
  sub: donoId,
  email,
  iat: agoraSeg,
  exp: agoraSeg + 30 * 24 * 60 * 60,
})
const assinatura = createHmac('sha256', segredo).update(`${cabecalho}.${corpo}`).digest('base64url')
console.log(`\nTOKEN=${cabecalho}.${corpo}.${assinatura}`)
