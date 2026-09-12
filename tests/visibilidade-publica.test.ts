// Segundo teste prioritário da seção 22: rascunho não vaza para ninguém além do
// próprio dono. Sem RLS de banco, é o código destas rotas que garante isso.
// Cobre os critérios 8.3 e 8.5.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONTA_A,
  CONTA_ADMIN,
  CONTA_B,
  livroFalso,
  mockFirebase,
  mockNextAuth,
  semSessao,
  sessaoDe,
  usuarioFalso,
} from './duplos'

mockNextAuth()
mockFirebase()

import * as firestore from '@/lib/firebase/firestore'
import * as storage from '@/lib/firebase/storage'

async function pedirMetadados(handle = 'ana', slug = 'conceitos') {
  const { GET } = await import('@/app/api/livros/[handle]/[slug]/route')
  return GET(new Request(`http://localhost/api/livros/${handle}/${slug}`), {
    params: Promise.resolve({ handle, slug }),
  })
}

async function pedirPdf(query = '', cabecalhos: HeadersInit = {}) {
  const { GET } = await import('@/app/api/livros/[handle]/[slug]/pdf/route')
  return GET(
    new Request(`http://localhost/api/livros/ana/conceitos/pdf${query}`, { headers: cabecalhos }),
    { params: Promise.resolve({ handle: 'ana', slug: 'conceitos' }) },
  )
}

async function pedirCapa(query = '') {
  const { GET } = await import('@/app/api/livros/[handle]/[slug]/capa/route')
  return GET(new Request(`http://localhost/api/livros/ana/conceitos/capa${query}`), {
    params: Promise.resolve({ handle: 'ana', slug: 'conceitos' }),
  })
}

// O arquivo que o Storage devolveria. A `versao` é a geração do objeto, que muda
// a cada sobrescrita — é ela que vira o ETag.
function arquivoFalso(extras: { tamanhoBytes?: number; versao?: string | null } = {}) {
  return {
    stream: streamFalso(),
    tamanhoBytes: extras.tamanhoBytes ?? 4,
    mimeType: 'application/pdf',
    versao: extras.versao === undefined ? '1700000000000001' : extras.versao,
  }
}

function streamFalso() {
  return new ReadableStream<Uint8Array>({
    start(controlador) {
      controlador.enqueue(new Uint8Array([37, 80, 68, 70]))
      controlador.close()
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(firestore.buscarUsuarioPorHandle).mockResolvedValue(usuarioFalso({ id: CONTA_A.id }))
  vi.mocked(firestore.garantirUsuario).mockImplementation(async ({ id, email }) =>
    usuarioFalso({ id, email }),
  )
})

describe('rascunho não vaza — critério 8.3', () => {
  beforeEach(() => {
    vi.mocked(firestore.buscarLivroPorDonoESlug).mockResolvedValue(livroFalso({ publicado: false }))
  })

  it('metadados devolvem 404 para visitante sem sessão', async () => {
    semSessao()
    const resposta = await pedirMetadados()
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ erro: 'Esse livro não está disponível.' })
  })

  it('metadados devolvem 404 para OUTRO autor logado', async () => {
    sessaoDe(CONTA_B.id, CONTA_B.email)
    expect((await pedirMetadados()).status).toBe(404)
  })

  it('metadados devolvem 404 até para o admin da plataforma — nota da seção 5', async () => {
    sessaoDe(CONTA_ADMIN.id, CONTA_ADMIN.email)
    expect((await pedirMetadados()).status).toBe(404)
  })

  it('o PDF devolve 404 e o Storage não é tocado', async () => {
    semSessao()
    expect((await pedirPdf()).status).toBe(404)
    expect(storage.baixarArquivo).not.toHaveBeenCalled()
  })

  it('a capa devolve 404 e o Storage não é tocado', async () => {
    semSessao()
    expect((await pedirCapa()).status).toBe(404)
    expect(storage.baixarArquivo).not.toHaveBeenCalled()
  })

  it('o dono enxerga o próprio rascunho — é a prévia da seção 9', async () => {
    sessaoDe(CONTA_A.id, CONTA_A.email)
    expect((await pedirMetadados()).status).toBe(200)
  })
})

describe('handle e slug inexistentes — critérios 8.3 e 8.5', () => {
  it('handle inexistente dá 404 e nem chega a procurar o livro', async () => {
    semSessao()
    vi.mocked(firestore.buscarUsuarioPorHandle).mockResolvedValue(null)
    expect((await pedirMetadados('nao-existe')).status).toBe(404)
    expect(firestore.buscarLivroPorDonoESlug).not.toHaveBeenCalled()
  })

  it('slug inexistente dá a mesma resposta de rascunho alheio', async () => {
    semSessao()
    vi.mocked(firestore.buscarLivroPorDonoESlug).mockResolvedValue(null)
    const inexistente = await pedirMetadados()
    vi.mocked(firestore.buscarLivroPorDonoESlug).mockResolvedValue(livroFalso({ publicado: false }))
    const rascunho = await pedirMetadados()
    expect(inexistente.status).toBe(rascunho.status)
    await expect(inexistente.json()).resolves.toEqual(await rascunho.json())
  })

  it('a vitrine de handle inexistente devolve 404 com a copy da seção 15', async () => {
    vi.mocked(firestore.buscarUsuarioPorHandle).mockResolvedValue(null)
    const { GET } = await import('@/app/api/autores/[handle]/route')
    const resposta = await GET(new Request('http://localhost/x'), {
      params: Promise.resolve({ handle: 'nao-existe' }),
    })
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ erro: 'Esse endereço não existe.' })
  })
})

describe('livro publicado é servido a qualquer visitante — critérios 8.3 e 8.4', () => {
  beforeEach(() => {
    semSessao()
    vi.mocked(firestore.buscarLivroPorDonoESlug).mockResolvedValue(livroFalso({ publicado: true }))
  })

  it('os metadados não expõem caminho do Storage, dono nem e-mail', async () => {
    const resposta = await pedirMetadados()
    expect(resposta.status).toBe(200)
    const corpo = JSON.stringify(await resposta.json())
    expect(corpo).not.toContain('livros/conta-a')
    expect(corpo).not.toContain('conta-a')
    expect(corpo).not.toContain('@exemplo.com')
  })

  it('?download=1 serve com o título do livro como nome do arquivo', async () => {
    vi.mocked(storage.baixarArquivo).mockResolvedValue(arquivoFalso({ tamanhoBytes: 4 }))
    const resposta = await pedirPdf('?download=1')
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('Content-Type')).toBe('application/pdf')
    expect(resposta.headers.get('Content-Disposition')).toContain(
      'attachment; filename="Conceitos de Tecnologia.pdf"',
    )
  })

  it('sem o parâmetro, serve inline — é assim que o PDF.js lê e o "Imprimir" abre', async () => {
    vi.mocked(storage.baixarArquivo).mockResolvedValue(arquivoFalso({ tamanhoBytes: 4 }))
    const resposta = await pedirPdf()
    expect(resposta.headers.get('Content-Disposition')).toBeNull()
  })

  it('contabiliza o tráfego na conta do dono — regra 11.11', async () => {
    vi.mocked(storage.baixarArquivo).mockResolvedValue(arquivoFalso({ tamanhoBytes: 9_000_000 }))
    await pedirPdf()
    expect(firestore.somarTrafego).toHaveBeenCalledWith(CONTA_A.id, 9_000_000)
  })

  it('rascunho em prévia nunca vai para cache de CDN', async () => {
    sessaoDe(CONTA_A.id, CONTA_A.email)
    vi.mocked(firestore.buscarLivroPorDonoESlug).mockResolvedValue(livroFalso({ publicado: false }))
    vi.mocked(storage.baixarArquivo).mockResolvedValue(arquivoFalso({ tamanhoBytes: 4 }))
    const resposta = await pedirPdf()
    expect(resposta.headers.get('Cache-Control')).toBe('private, no-store')
  })
})

// O bug que estes testes travam: a rota do PDF e a da capa têm endereço fixo, e
// serviam tudo com uma hora de cache. Quem substituía o arquivo de um livro
// publicado continuava vendo o PDF antigo, porque a URL não mudava e o cache não
// tinha por que perguntar de novo (critério 8.2).
describe('PDF substituído chega a quem já leu o livro — critério 8.2', () => {
  beforeEach(() => {
    semSessao()
    vi.mocked(firestore.buscarLivroPorDonoESlug).mockResolvedValue(livroFalso({ publicado: true }))
    vi.mocked(storage.baixarArquivo).mockResolvedValue(arquivoFalso())
  })

  it('URL sem versão revalida a cada uso — é o link que já está solto por aí', async () => {
    const resposta = await pedirPdf()
    expect(resposta.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
  })

  it('URL com ?v= pode ficar guardada para sempre: trocar o arquivo troca a URL', async () => {
    const resposta = await pedirPdf('?v=abc123')
    expect(resposta.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
  })

  it('o ETag é a geração do objeto no Storage, que muda a cada sobrescrita', async () => {
    const resposta = await pedirPdf()
    expect(resposta.headers.get('ETag')).toBe('"1700000000000001"')
  })

  it('mesmo arquivo devolve 304 e não conta tráfego — regra 11.11', async () => {
    const resposta = await pedirPdf('', { 'if-none-match': '"1700000000000001"' })
    expect(resposta.status).toBe(304)
    expect(firestore.somarTrafego).not.toHaveBeenCalled()
  })

  it('arquivo trocado não devolve 304: a geração de quem pergunta é a antiga', async () => {
    const resposta = await pedirPdf('', { 'if-none-match': '"1699999999999999"' })
    expect(resposta.status).toBe(200)
  })

  it('a capa segue a mesma política — ela também é regerada na substituição', async () => {
    const semVersao = await pedirCapa()
    expect(semVersao.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
    expect(semVersao.headers.get('ETag')).toBe('"1700000000000001"')

    vi.mocked(storage.baixarArquivo).mockResolvedValue(arquivoFalso())
    const comVersao = await pedirCapa('?v=abc123')
    expect(comVersao.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
  })
})

describe('vitrine do autor — critério 8.5', () => {
  it('lista só publicados, do mais recente ao mais antigo, e sem e-mail', async () => {
    vi.mocked(firestore.listarLivrosDoDono).mockResolvedValue([
      livroFalso({ id: 'a', slug: 'antigo', publicado: true, criado_em: '2026-01-01T00:00:00.000Z' }),
      livroFalso({ id: 'b', slug: 'rascunho', publicado: false, criado_em: '2026-05-01T00:00:00.000Z' }),
      livroFalso({ id: 'c', slug: 'novo', publicado: true, criado_em: '2026-09-01T00:00:00.000Z' }),
    ])
    const { GET } = await import('@/app/api/autores/[handle]/route')
    const resposta = await GET(new Request('http://localhost/x'), {
      params: Promise.resolve({ handle: 'ana' }),
    })
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(corpo.livros.map((livro: { slug: string }) => livro.slug)).toEqual(['novo', 'antigo'])
    expect(JSON.stringify(corpo)).not.toContain('@exemplo.com')
  })
})
