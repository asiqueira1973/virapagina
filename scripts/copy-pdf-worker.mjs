// Copia o worker do PDF.js do node_modules para /public.
//
// O PDF.js renderiza as páginas numa thread separada e precisa carregar esse
// arquivo por URL. Servi-lo de /public é a forma que não depende de como o
// bundler resolve `new URL(..., import.meta.url)` — e a renderização das páginas
// é o coração do produto (princípio 0.1), então ela não pode depender de sorte.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const raizPdfjs = dirname(require.resolve('pdfjs-dist/package.json'))
const origem = join(raizPdfjs, 'build', 'pdf.worker.min.mjs')
const destino = join(process.cwd(), 'public', 'pdf.worker.min.mjs')

mkdirSync(dirname(destino), { recursive: true })
copyFileSync(origem, destino)
console.log(`worker do PDF.js copiado para ${destino}`)
