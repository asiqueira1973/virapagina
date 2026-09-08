// Teste prioritário da seção 22: sem banco relacional não existe RLS como segunda
// camada de defesa, então esta guarda é a única coisa entre um estranho e o
// painel do Alexandre (seções 20 e 23). Cobre os critérios de aceite 8.1.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNextAuth, sessaoDeAdmin, sessaoDeEstranho, semSessao } from './helpers'

mockNextAuth()

// O Sheets e o Drive são substituídos por espiões: qualquer chamada a eles numa
// requisição não autorizada é falha de segurança, não detalhe de implementação.
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
import { requireAdmin } from '@/lib/google/auth'

// Todas as rotas sob /api/admin/*, cada uma com uma requisição plausível.
const rotasDeAdmin = [
  {
    nome: 'POST /api/admin/livros',
    executar: async () => {
      const { POST } = await import('@/app/api/admin/livros/route')
      return POST(
        new Request('http://localhost/api/admin/livros', {
          method: 'POST',
          body: JSON.stringify({ titulo: 'Teste', arquivo_pdf_drive_id: 'abc' }),
        }),
      )
    },
  },
  {
    nome: 'POST /api/admin/livros/sessao-upload',
    executar: async () => {
      const { POST } = await import('@/app/api/admin/livros/sessao-upload/route')
      return POST(
        new Request('http://localhost/api/admin/livros/sessao-upload', {
          method: 'POST',
          body: JSON.stringify({
            nome: 'livro.pdf',
            mimeType: 'application/pdf',
            tamanhoBytes: 1000,
          }),
        }),
      )
    },
  },
  {
    nome: 'GET /api/admin/livros/slug-disponivel',
    executar: async () => {
      const { GET } = await import('@/app/api/admin/livros/slug-disponivel/route')
      return GET(new Request('http://localhost/api/admin/livros/slug-disponivel?slug=teste'))
    },
  },
  {
    nome: 'PUT /api/admin/livros/[id]',
    executar: async () => {
      const { PUT } = await import('@/app/api/admin/livros/[id]/route')
      return PUT(
        new Request('http://localhost/api/admin/livros/1', {
          method: 'PUT',
          body: JSON.stringify({ titulo: 'Teste' }),
        }),
        { params: Promise.resolve({ id: '1' }) },
      )
    },
  },
  {
    nome: 'DELETE /api/admin/livros/[id]',
    executar: async () => {
      const { DELETE } = await import('@/app/api/admin/livros/[id]/route')
      return DELETE(new Request('http://localhost/api/admin/livros/1', { method: 'DELETE' }), {
        params: Promise.resolve({ id: '1' }),
      })
    },
  },
  {
    nome: 'POST /api/admin/livros/[id]/publicar',
    executar: async () => {
      const { POST } = await import('@/app/api/admin/livros/[id]/publicar/route')
      return POST(new Request('http://localhost/api/admin/livros/1/publicar', { method: 'POST' }), {
        params: Promise.resolve({ id: '1' }),
      })
    },
  },
  {
    nome: 'POST /api/admin/livros/[id]/despublicar',
    executar: async () => {
      const { POST } = await import('@/app/api/admin/livros/[id]/despublicar/route')
      return POST(
        new Request('http://localhost/api/admin/livros/1/despublicar', { method: 'POST' }),
        { params: Promise.resolve({ id: '1' }) },
      )
    },
  },
  {
    nome: 'POST /api/admin/livros/[id]/substituir-pdf',
    executar: async () => {
      const { POST } = await import('@/app/api/admin/livros/[id]/substituir-pdf/route')
      return POST(
        new Request('http://localhost/api/admin/livros/1/substituir-pdf', {
          method: 'POST',
          body: JSON.stringify({ arquivo_pdf_drive_id: 'novo' }),
        }),
        { params: Promise.resolve({ id: '1' }) },
      )
    },
  },
]

// Confere que nenhum espião do Google foi chamado — o critério 8.1 exige que a
// rota não leia nem escreva nada antes de confirmar requireAdmin().
function nenhumaChamadaAoGoogle() {
  for (const espiao of Object.values(sheets)) {
    if (typeof espiao === 'function') expect(espiao).not.toHaveBeenCalled()
  }
  for (const espiao of Object.values(drive)) {
    if (typeof espiao === 'function') expect(espiao).not.toHaveBeenCalled()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAdmin() — seções 5 e 6', () => {
  it('recusa quem não está logado', async () => {
    semSessao()
    const resultado = await requireAdmin()
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) expect(resultado.resposta.status).toBe(401)
  })

  it('recusa quem está logado no Google mas fora de ADMIN_ALLOWED_EMAILS', async () => {
    sessaoDeEstranho()
    const resultado = await requireAdmin()
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) expect(resultado.resposta.status).toBe(403)
  })

  it('aceita o e-mail que está na allowlist', async () => {
    sessaoDeAdmin()
    const resultado = await requireAdmin()
    expect(resultado.autorizado).toBe(true)
    if (resultado.autorizado) {
      expect(resultado.email).toBe('alexandre.silva.siqueira@gmail.com')
    }
  })
})

describe('rotas /api/admin/* — critério 8.1 e seção 22', () => {
  for (const rota of rotasDeAdmin) {
    it(`${rota.nome} devolve 401 sem sessão e não toca no Google`, async () => {
      semSessao()
      const resposta = await rota.executar()
      expect(resposta.status).toBe(401)
      nenhumaChamadaAoGoogle()
    })

    it(`${rota.nome} devolve 403 para e-mail fora da allowlist e não toca no Google`, async () => {
      sessaoDeEstranho()
      const resposta = await rota.executar()
      expect(resposta.status).toBe(403)
      nenhumaChamadaAoGoogle()
    })
  }
})
