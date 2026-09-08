// Segundo teste prioritário da seção 22: rascunho não pode vazar para visitante.
// Sem RLS de banco, é o código destas rotas que garante isso (seções 6, 20 e 23).
// Cobre os critérios de aceite 8.3 (404 do leitor) e 8.5 (catálogo).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Livro } from '@/types/livro'
import { mockNextAuth, sessaoDeAdmin, sessaoDeEstranho, semSessao } from './helpers'

mockNextAuth()

vi.mock('@/lib/google/sheets', () => ({
  TAG_CACHE_LIVROS: 'livros',
  readAllBooks: vi.fn(),
  readAllBooksCached: vi.fn(),
  findBookById: vi.fn(),
  findBookBySlug: vi.fn(),
  insertBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBookRow: vi.fn(),
  slugEmUso: vi.fn(),
  sugerirSlugDisponivel: vi.fn(),
}))
vi.mock('@/lib/google/drive', () => ({
  createResumableUploadSession: vi.fn(),
  uploadFile: vi.fn(),
  uploadCapaPng: vi.fn(),
  getFileMetadata: vi.fn(),
  downloadFileStream: vi.fn(),
  deleteFile: vi.fn(),
}))

import * as drive from '@/lib/google/drive'
import * as sheets from '@/lib/google/sheets'

// Molde de livro para os cenários abaixo.
function livroFalso(sobrescritas: Partial<Livro> = {}): Livro {
  return {
    id: 'id-1',
    titulo: 'Conceitos de Tecnologia',
    subtitulo: null,
    slug: 'conceitos-de-tecnologia',
    autor: 'Alexandre Siqueira',
    descricao: null,
    arquivo_pdf_drive_id: 'drive-pdf-1',
    arquivo_pdf_tamanho_bytes: 9_000_000,
    capa_drive_id: 'drive-capa-1',
    total_paginas: 44,
    publicado: 'nao',
    criado_por: 'alexandre.silva.siqueira@gmail.com',
    criado_em: '2026-09-01T10:00:00.000Z',
    atualizado_em: '2026-09-01T10:00:00.000Z',
    ...sobrescritas,
  }
}

async function pedirMetadados(slug = 'conceitos-de-tecnologia') {
  const { GET } = await import('@/app/api/livros/[slug]/route')
  return GET(new Request(`http://localhost/api/livros/${slug}`), {
    params: Promise.resolve({ slug }),
  })
}

async function pedirPdf(slug = 'conceitos-de-tecnologia') {
  const { GET } = await import('@/app/api/livros/[slug]/pdf/route')
  return GET(new Request(`http://localhost/api/livros/${slug}/pdf`), {
    params: Promise.resolve({ slug }),
  })
}

async function pedirCapa(slug = 'conceitos-de-tecnologia') {
  const { GET } = await import('@/app/api/livros/[slug]/capa/route')
  return GET(new Request(`http://localhost/api/livros/${slug}/capa`), {
    params: Promise.resolve({ slug }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('rascunho não vaza para visitante — critérios 8.3 e seção 22', () => {
  it('GET /api/livros/[slug] devolve 404 para rascunho sem sessão', async () => {
    semSessao()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(livroFalso({ publicado: 'nao' }))
    const resposta = await pedirMetadados()
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ erro: 'Esse livro não está disponível.' })
  })

  it('GET /api/livros/[slug] devolve 404 para rascunho com e-mail fora da allowlist', async () => {
    sessaoDeEstranho()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(livroFalso({ publicado: 'nao' }))
    const resposta = await pedirMetadados()
    expect(resposta.status).toBe(404)
  })

  it('GET /api/livros/[slug]/pdf devolve 404 para rascunho sem sessão e não baixa nada do Drive', async () => {
    semSessao()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(livroFalso({ publicado: 'nao' }))
    const resposta = await pedirPdf()
    expect(resposta.status).toBe(404)
    expect(drive.downloadFileStream).not.toHaveBeenCalled()
  })

  it('GET /api/livros/[slug]/capa devolve 404 para rascunho sem sessão e não baixa nada do Drive', async () => {
    semSessao()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(livroFalso({ publicado: 'nao' }))
    const resposta = await pedirCapa()
    expect(resposta.status).toBe(404)
    expect(drive.downloadFileStream).not.toHaveBeenCalled()
  })

  it('slug inexistente devolve 404', async () => {
    semSessao()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(null)
    const resposta = await pedirMetadados('nao-existe')
    expect(resposta.status).toBe(404)
  })
})

describe('livro publicado é servido a qualquer visitante — critérios 8.3 e 8.4', () => {
  it('GET /api/livros/[slug] devolve os metadados sem expor ids do Drive', async () => {
    semSessao()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(livroFalso({ publicado: 'sim' }))
    const resposta = await pedirMetadados()
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(corpo.livro.slug).toBe('conceitos-de-tecnologia')
    expect(corpo.livro.tem_capa).toBe(true)
    // Os ids de arquivo do Drive nunca saem do servidor (seção 4).
    expect(JSON.stringify(corpo)).not.toContain('drive-pdf-1')
    expect(JSON.stringify(corpo)).not.toContain('drive-capa-1')
    // Nem o e-mail de quem criou.
    expect(JSON.stringify(corpo)).not.toContain('@gmail.com')
  })

  it('GET /api/livros/[slug]/pdf?download=1 serve com o título como nome de arquivo', async () => {
    semSessao()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(livroFalso({ publicado: 'sim' }))
    vi.mocked(drive.downloadFileStream).mockResolvedValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([37, 80, 68, 70]))
          controller.close()
        },
      }),
    )
    const { GET } = await import('@/app/api/livros/[slug]/pdf/route')
    const resposta = await GET(
      new Request('http://localhost/api/livros/conceitos-de-tecnologia/pdf?download=1'),
      { params: Promise.resolve({ slug: 'conceitos-de-tecnologia' }) },
    )
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('Content-Type')).toBe('application/pdf')
    expect(resposta.headers.get('Content-Disposition')).toContain(
      'attachment; filename="Conceitos de Tecnologia.pdf"',
    )
  })
})

describe('prévia de rascunho para o admin — critério 8.3 e seção 13', () => {
  it('admin logado enxerga o rascunho', async () => {
    sessaoDeAdmin()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(livroFalso({ publicado: 'nao' }))
    const resposta = await pedirMetadados()
    expect(resposta.status).toBe(200)
  })

  it('a prévia do admin nunca vem do cache de 60 segundos', async () => {
    sessaoDeAdmin()
    vi.mocked(sheets.findBookBySlug).mockResolvedValue(livroFalso({ publicado: 'nao' }))
    await pedirMetadados()
    // segundo argumento `usarCache` precisa vir false para o admin (regra 11.7)
    expect(sheets.findBookBySlug).toHaveBeenCalledWith('conceitos-de-tecnologia', false)
  })
})

describe('catálogo público — critério 8.5', () => {
  it('lista só publicados, do mais recente para o mais antigo', async () => {
    semSessao()
    vi.mocked(sheets.readAllBooksCached).mockResolvedValue([
      livroFalso({ id: 'a', slug: 'antigo', publicado: 'sim', criado_em: '2026-01-01T00:00:00.000Z' }),
      livroFalso({ id: 'b', slug: 'rascunho', publicado: 'nao', criado_em: '2026-05-01T00:00:00.000Z' }),
      livroFalso({ id: 'c', slug: 'novo', publicado: 'sim', criado_em: '2026-09-01T00:00:00.000Z' }),
    ])
    const { GET } = await import('@/app/api/livros/route')
    const resposta = await GET()
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(corpo.livros.map((livro: { slug: string }) => livro.slug)).toEqual(['novo', 'antigo'])
  })
})
