// Teste prioritário da seção 22: sem banco relacional não existe RLS como segunda
// camada de defesa, então estas guardas são a única coisa entre um estranho e o
// conteúdo de todo mundo (seções 20 e 23).
//
// Duas afirmações por rota, e a segunda é a que importa:
//   1. o código de resposta está certo;
//   2. **nada foi tocado no Firestore nem no Storage** numa requisição sem sessão.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTA_ADMIN, mockFirebase, mockNextAuth, semSessao, sessaoDe, CONTA_A } from './duplos'

mockNextAuth()
mockFirebase()

import * as firestore from '@/lib/firebase/firestore'
import * as storage from '@/lib/firebase/storage'
import { requireAdminPlataforma, requireAutor, requireDonoDoLivro } from '@/lib/guards'

// Toda rota que exige sessão de autor, com uma requisição plausível.
const rotasDeAutor = [
  {
    nome: 'GET /api/conta/handle',
    executar: async () => {
      const { GET } = await import('@/app/api/conta/handle/route')
      return GET(new Request('http://localhost/api/conta/handle?handle=ana'))
    },
  },
  {
    nome: 'POST /api/conta/handle',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/handle/route')
      return POST(
        new Request('http://localhost/api/conta/handle', {
          method: 'POST',
          body: JSON.stringify({ handle: 'ana' }),
        }),
      )
    },
  },
  {
    nome: 'GET /api/conta/livros/slug-disponivel',
    executar: async () => {
      const { GET } = await import('@/app/api/conta/livros/slug-disponivel/route')
      return GET(new Request('http://localhost/api/conta/livros/slug-disponivel?slug=teste'))
    },
  },
  {
    nome: 'POST /api/conta/livros/sessao-upload',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/livros/sessao-upload/route')
      return POST(
        new Request('http://localhost/api/conta/livros/sessao-upload', {
          method: 'POST',
          body: JSON.stringify({ mimeType: 'application/pdf', tamanhoBytes: 1000 }),
        }),
      )
    },
  },
  {
    nome: 'POST /api/conta/livros',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/livros/route')
      return POST(
        new Request('http://localhost/api/conta/livros', {
          method: 'POST',
          body: JSON.stringify({ titulo: 'Teste', livro_id: 'abc' }),
        }),
      )
    },
  },
  {
    nome: 'PUT /api/conta/livros/[id]',
    executar: async () => {
      const { PUT } = await import('@/app/api/conta/livros/[id]/route')
      return PUT(
        new Request('http://localhost/api/conta/livros/livro-1', {
          method: 'PUT',
          body: JSON.stringify({ titulo: 'Teste' }),
        }),
        { params: Promise.resolve({ id: 'livro-1' }) },
      )
    },
  },
  {
    nome: 'DELETE /api/conta/livros/[id]',
    executar: async () => {
      const { DELETE } = await import('@/app/api/conta/livros/[id]/route')
      return DELETE(new Request('http://localhost/x', { method: 'DELETE' }), {
        params: Promise.resolve({ id: 'livro-1' }),
      })
    },
  },
  {
    nome: 'POST /api/conta/livros/[id]/publicar',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/livros/[id]/publicar/route')
      return POST(new Request('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ id: 'livro-1' }),
      })
    },
  },
  {
    nome: 'POST /api/conta/livros/[id]/despublicar',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/livros/[id]/despublicar/route')
      return POST(new Request('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ id: 'livro-1' }),
      })
    },
  },
  {
    nome: 'POST /api/conta/livros/[id]/substituir-pdf',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/livros/[id]/substituir-pdf/route')
      return POST(
        new Request('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({ total_paginas: 10 }),
        }),
        { params: Promise.resolve({ id: 'livro-1' }) },
      )
    },
  },
]

// Toda rota que exige ser admin da plataforma.
const rotasDeAdmin = [
  {
    nome: 'GET /api/admin/contas',
    executar: async () => {
      const { GET } = await import('@/app/api/admin/contas/route')
      return GET()
    },
  },
  {
    nome: 'POST /api/admin/contas/[id]/plano',
    executar: async () => {
      const { POST } = await import('@/app/api/admin/contas/[id]/plano/route')
      return POST(
        new Request('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({ plano: 'ate_20' }),
        }),
        { params: Promise.resolve({ id: 'conta-a' }) },
      )
    },
  },
  {
    nome: 'POST /api/admin/contas/[id]/handle',
    executar: async () => {
      const { POST } = await import('@/app/api/admin/contas/[id]/handle/route')
      return POST(
        new Request('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({ handle: 'novo' }),
        }),
        { params: Promise.resolve({ id: 'conta-a' }) },
      )
    },
  },
  {
    nome: 'POST /api/admin/livros/[id]/remover',
    executar: async () => {
      const { POST } = await import('@/app/api/admin/livros/[id]/remover/route')
      return POST(new Request('http://localhost/x', { method: 'POST', body: '{}' }), {
        params: Promise.resolve({ id: 'livro-1' }),
      })
    },
  },
]

// Nenhuma função do Firestore ou do Storage pode ter sido chamada.
function nadaFoiTocado() {
  for (const espiao of Object.values(firestore)) {
    if (typeof espiao === 'function' && 'mock' in espiao) expect(espiao).not.toHaveBeenCalled()
  }
  for (const espiao of Object.values(storage)) {
    if (typeof espiao === 'function' && 'mock' in espiao) expect(espiao).not.toHaveBeenCalled()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAutor() — seção 6', () => {
  it('recusa quem não está logado, sem tocar no banco', async () => {
    semSessao()
    const resultado = await requireAutor()
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) expect(resultado.resposta.status).toBe(401)
    nadaFoiTocado()
  })

  it('devolve 409 e o destino da tela quando a conta ainda não tem handle', async () => {
    sessaoDe(CONTA_A.id, CONTA_A.email)
    vi.mocked(firestore.garantirUsuario).mockResolvedValue({
      id: CONTA_A.id,
      email: CONTA_A.email,
      nome: null,
      handle: null,
      plano: 'gratuito',
      origem: 'web',
      assinatura: null,
      trafego_mes_bytes: 0,
      trafego_mes_referencia: '2026-09',
      criado_em: '',
      atualizado_em: '',
    })
    const resultado = await requireAutor()
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) {
      expect(resultado.resposta.status).toBe(409)
      await expect(resultado.resposta.json()).resolves.toMatchObject({ destino: '/conta/handle' })
    }
  })
})

describe('requireAdminPlataforma() — seção 5', () => {
  it('recusa quem não está logado, sem tocar no banco', async () => {
    semSessao()
    const resultado = await requireAdminPlataforma()
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) expect(resultado.resposta.status).toBe(401)
    nadaFoiTocado()
  })

  it('recusa autor comum com 403, sem tocar no banco', async () => {
    sessaoDe(CONTA_A.id, CONTA_A.email)
    const resultado = await requireAdminPlataforma()
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) expect(resultado.resposta.status).toBe(403)
    nadaFoiTocado()
  })

  it('aceita e-mail que está em ADMIN_ALLOWED_EMAILS', async () => {
    sessaoDe(CONTA_ADMIN.id, CONTA_ADMIN.email)
    const resultado = await requireAdminPlataforma()
    expect(resultado.autorizado).toBe(true)
  })
})

describe('rotas do autor — critério 8.1', () => {
  for (const rota of rotasDeAutor) {
    it(`${rota.nome} devolve 401 sem sessão e não toca no Google`, async () => {
      semSessao()
      const resposta = await rota.executar()
      expect(resposta.status).toBe(401)
      nadaFoiTocado()
    })
  }
})

describe('rotas da plataforma — critério 8.7', () => {
  for (const rota of rotasDeAdmin) {
    it(`${rota.nome} devolve 401 sem sessão e não toca no Google`, async () => {
      semSessao()
      const resposta = await rota.executar()
      expect(resposta.status).toBe(401)
      nadaFoiTocado()
    })

    it(`${rota.nome} devolve 403 para autor comum e não toca no Google`, async () => {
      sessaoDe(CONTA_A.id, CONTA_A.email)
      const resposta = await rota.executar()
      expect(resposta.status).toBe(403)
      nadaFoiTocado()
    })
  }
})

describe('rotina de tráfego — seção 13.4', () => {
  it('recusa quem não traz o CRON_SECRET, sem tocar no banco', async () => {
    const { POST } = await import('@/app/api/rotinas/avisar-trafego/route')
    const resposta = await POST(new Request('http://localhost/x', { method: 'POST' }))
    expect(resposta.status).toBe(401)
    nadaFoiTocado()
  })

  it('aceita com o segredo certo', async () => {
    vi.mocked(firestore.listarUsuarios).mockResolvedValue([])
    const { POST } = await import('@/app/api/rotinas/avisar-trafego/route')
    const resposta = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        headers: { authorization: 'Bearer cron-de-teste' },
      }),
    )
    expect(resposta.status).toBe(200)
  })
})

// requireDonoDoLivro tem teste próprio em isolamento-entre-contas.test.ts, que é
// onde a comparação de dono realmente importa.
describe('requireDonoDoLivro() — seção 6', () => {
  it('recusa quem não está logado, sem tocar no banco', async () => {
    semSessao()
    const resultado = await requireDonoDoLivro('livro-1')
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) expect(resultado.resposta.status).toBe(401)
    nadaFoiTocado()
  })
})
