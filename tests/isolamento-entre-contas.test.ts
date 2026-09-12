// O teste que mais importa deste repositório (spec seção 22 e risco da seção 23).
//
// Num produto multi-tenant sem RLS, vazar dado entre contas é o único erro que
// não tem conserto. Cada rota que aceita um id de livro é exercitada com a
// sessão de OUTRA conta, e o que se verifica é duplo:
//
//   1. a resposta é **404, não 403** — responder "existe, mas não é seu"
//      confirmaria a existência de um rascunho alheio;
//   2. **nenhuma escrita acontece** — nem no Firestore, nem no Storage.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTA_A, CONTA_B, livroFalso, mockFirebase, mockNextAuth, sessaoDe, usuarioFalso } from './duplos'

mockNextAuth()
mockFirebase()

import * as firestore from '@/lib/firebase/firestore'
import * as storage from '@/lib/firebase/storage'
import { requireDonoDoLivro } from '@/lib/guards'

// Tudo que grava. Numa requisição de quem não é dono, nenhuma pode ser chamada.
function nenhumaEscritaAconteceu() {
  const escritas = [
    firestore.criarLivro,
    firestore.atualizarLivro,
    firestore.excluirLivro,
    firestore.alterarPlano,
    firestore.reservarHandle,
    firestore.trocarHandle,
    storage.criarSessaoDeUpload,
    storage.enviarCapaPng,
    storage.apagarArquivo,
    storage.apagarPasta,
    storage.apagarPastaDoLivro,
  ]
  for (const escrita of escritas) expect(escrita).not.toHaveBeenCalled()
}

// As rotas que recebem o id de um livro. `livro-de-b` pertence à conta B.
const rotasComIdDeLivro = [
  {
    nome: 'PUT /api/conta/livros/[id]',
    executar: async () => {
      const { PUT } = await import('@/app/api/conta/livros/[id]/route')
      return PUT(
        new Request('http://localhost/x', {
          method: 'PUT',
          body: JSON.stringify({ titulo: 'Sequestrado', slug: 'sequestrado' }),
        }),
        { params: Promise.resolve({ id: 'livro-de-b' }) },
      )
    },
  },
  {
    nome: 'DELETE /api/conta/livros/[id]',
    executar: async () => {
      const { DELETE } = await import('@/app/api/conta/livros/[id]/route')
      return DELETE(new Request('http://localhost/x', { method: 'DELETE' }), {
        params: Promise.resolve({ id: 'livro-de-b' }),
      })
    },
  },
  {
    nome: 'POST /api/conta/livros/[id]/publicar',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/livros/[id]/publicar/route')
      return POST(new Request('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ id: 'livro-de-b' }),
      })
    },
  },
  {
    nome: 'POST /api/conta/livros/[id]/despublicar',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/livros/[id]/despublicar/route')
      return POST(new Request('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ id: 'livro-de-b' }),
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
          body: JSON.stringify({ total_paginas: 1, capa_base64: 'data:image/png;base64,AAAA' }),
        }),
        { params: Promise.resolve({ id: 'livro-de-b' }) },
      )
    },
  },
  {
    // O id do livro chega no corpo, e não na URL — mas é um id de livro igual
    // aos outros, e abre uma sessão de escrita no Storage.
    nome: 'POST /api/conta/livros/sessao-upload (substituição)',
    executar: async () => {
      const { POST } = await import('@/app/api/conta/livros/sessao-upload/route')
      return POST(
        new Request('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({
            mimeType: 'application/pdf',
            tamanhoBytes: 1000,
            livro_id: 'livro-de-b',
          }),
        }),
      )
    },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  // A conta A está logada e existe.
  sessaoDe(CONTA_A.id, CONTA_A.email)
  vi.mocked(firestore.garantirUsuario).mockResolvedValue(usuarioFalso({ id: CONTA_A.id }))
  // O livro pedido é da conta B.
  vi.mocked(firestore.buscarLivroPorId).mockResolvedValue(
    livroFalso({ id: 'livro-de-b', dono_id: CONTA_B.id, publicado: false }),
  )
})

describe('a conta A não alcança o livro da conta B', () => {
  for (const rota of rotasComIdDeLivro) {
    it(`${rota.nome} devolve 404 e não escreve nada`, async () => {
      const resposta = await rota.executar()
      expect(resposta.status).toBe(404)
      nenhumaEscritaAconteceu()
    })
  }

  it('a guarda devolve 404, e não 403 — o código não revela que o livro existe', async () => {
    const resultado = await requireDonoDoLivro('livro-de-b')
    expect(resultado.autorizado).toBe(false)
    if (!resultado.autorizado) {
      expect(resultado.resposta.status).toBe(404)
      await expect(resultado.resposta.json()).resolves.toEqual({ erro: 'Livro não encontrado.' })
    }
  })

  it('livro inexistente e livro de outra conta dão exatamente a mesma resposta', async () => {
    const deOutraConta = await requireDonoDoLivro('livro-de-b')
    vi.mocked(firestore.buscarLivroPorId).mockResolvedValue(null)
    const inexistente = await requireDonoDoLivro('nao-existe')

    expect(deOutraConta.autorizado).toBe(false)
    expect(inexistente.autorizado).toBe(false)
    if (!deOutraConta.autorizado && !inexistente.autorizado) {
      expect(deOutraConta.resposta.status).toBe(inexistente.resposta.status)
      await expect(deOutraConta.resposta.json()).resolves.toEqual(
        await inexistente.resposta.json(),
      )
    }
  })
})

describe('o dono alcança o próprio livro', () => {
  beforeEach(() => {
    vi.mocked(firestore.buscarLivroPorId).mockResolvedValue(
      livroFalso({ id: 'livro-de-a', dono_id: CONTA_A.id }),
    )
  })

  it('a guarda libera e devolve o livro junto da conta', async () => {
    const resultado = await requireDonoDoLivro('livro-de-a')
    expect(resultado.autorizado).toBe(true)
    if (resultado.autorizado) {
      expect(resultado.livro.dono_id).toBe(CONTA_A.id)
      expect(resultado.usuario.id).toBe(CONTA_A.id)
    }
  })

  it('publicar funciona e grava', async () => {
    vi.mocked(firestore.atualizarLivro).mockResolvedValue(
      livroFalso({ id: 'livro-de-a', dono_id: CONTA_A.id, publicado: true }),
    )
    const { POST } = await import('@/app/api/conta/livros/[id]/publicar/route')
    const resposta = await POST(new Request('http://localhost/x', { method: 'POST' }), {
      params: Promise.resolve({ id: 'livro-de-a' }),
    })
    expect(resposta.status).toBe(200)
    expect(firestore.atualizarLivro).toHaveBeenCalledWith('livro-de-a', { publicado: true })
  })

  it('livro removido por denúncia não volta pela mão do dono — regra 11.12', async () => {
    vi.mocked(firestore.buscarLivroPorId).mockResolvedValue(
      livroFalso({ id: 'livro-de-a', dono_id: CONTA_A.id, removido_por_denuncia: true }),
    )
    const { POST } = await import('@/app/api/conta/livros/[id]/publicar/route')
    const resposta = await POST(new Request('http://localhost/x', { method: 'POST' }), {
      params: Promise.resolve({ id: 'livro-de-a' }),
    })
    expect(resposta.status).toBe(409)
    expect(firestore.atualizarLivro).not.toHaveBeenCalled()
  })

  it('a exclusão apaga o documento ANTES dos arquivos — regra 11.6', async () => {
    const ordem: string[] = []
    vi.mocked(firestore.excluirLivro).mockImplementation(async () => {
      ordem.push('documento')
    })
    vi.mocked(storage.apagarPasta).mockImplementation(async () => {
      ordem.push('arquivos')
    })
    vi.mocked(storage.apagarPastaDoLivro).mockImplementation(async () => {
      ordem.push('arquivos')
    })
    const { DELETE } = await import('@/app/api/conta/livros/[id]/route')
    const resposta = await DELETE(new Request('http://localhost/x', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'livro-de-a' }),
    })
    expect(resposta.status).toBe(200)
    expect(ordem[0]).toBe('documento')
  })

  // Nos livros criados antes da correção do id, a pasta do PDF não é a derivada
  // do id do documento. Apagar só a derivada deixaria o PDF no bucket depois de
  // o autor mandar excluir — o contrário do que a página de privacidade promete.
  it('a exclusão apaga a pasta onde o PDF realmente está — regra 11.6', async () => {
    vi.mocked(firestore.buscarLivroPorId).mockResolvedValue(
      livroFalso({
        id: 'livro-de-a',
        dono_id: CONTA_A.id,
        arquivo_pdf_caminho: `livros/${CONTA_A.id}/pasta-antiga/original.pdf`,
      }),
    )
    const { DELETE } = await import('@/app/api/conta/livros/[id]/route')
    await DELETE(new Request('http://localhost/x', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'livro-de-a' }),
    })
    expect(storage.apagarPasta).toHaveBeenCalledWith(`livros/${CONTA_A.id}/pasta-antiga/`)
  })
})

// O defeito que estes testes travam: `criarLivro()` sorteava um id próprio em vez
// de usar o da sessão de upload, então o id do documento e o da pasta no Storage
// eram diferentes. Substituir o PDF derivava o caminho do id do documento e
// escrevia numa pasta que o leitor nunca abre — o autor trocava o arquivo e
// continuava vendo o antigo (critério 8.2).
describe('substituir o PDF escreve onde o leitor lê — critério 8.2', () => {
  const LIVRO_LEGADO = livroFalso({
    id: 'doc-id-novo',
    dono_id: CONTA_A.id,
    // Pasta com id diferente do documento: é o estado dos livros criados antes.
    arquivo_pdf_caminho: `livros/${CONTA_A.id}/pasta-antiga/original.pdf`,
    capa_caminho: `livros/${CONTA_A.id}/pasta-antiga/capa.png`,
  })

  beforeEach(() => {
    vi.mocked(firestore.buscarLivroPorId).mockResolvedValue(LIVRO_LEGADO)
    vi.mocked(storage.criarSessaoDeUpload).mockResolvedValue('https://upload.exemplo/sessao')
  })

  it('a sessão de upload abre no caminho que o livro registra, não num derivado do id', async () => {
    const { POST } = await import('@/app/api/conta/livros/sessao-upload/route')
    const resposta = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({
          mimeType: 'application/pdf',
          tamanhoBytes: 1000,
          livro_id: 'doc-id-novo',
        }),
      }),
    )
    expect(resposta.status).toBe(200)
    expect(storage.criarSessaoDeUpload).toHaveBeenCalledWith(
      expect.objectContaining({ caminho: `livros/${CONTA_A.id}/pasta-antiga/original.pdf` }),
    )
  })

  it('a substituição não consome vaga do plano — o livro já existe', async () => {
    vi.mocked(firestore.contarLivrosDoDono).mockResolvedValue(5)
    const { POST } = await import('@/app/api/conta/livros/sessao-upload/route')
    const resposta = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({
          mimeType: 'application/pdf',
          tamanhoBytes: 1000,
          livro_id: 'doc-id-novo',
        }),
      }),
    )
    expect(resposta.status).toBe(200)
  })

  it('a capa regerada vai para a pasta do PDF, e não para uma pasta à parte', async () => {
    vi.mocked(storage.enviarCapaPng).mockResolvedValue(true)
    vi.mocked(firestore.atualizarLivro).mockResolvedValue(LIVRO_LEGADO)
    const { POST } = await import('@/app/api/conta/livros/[id]/substituir-pdf/route')
    await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({ total_paginas: 10, capa_base64: 'data:image/png;base64,AAAA' }),
      }),
      { params: Promise.resolve({ id: 'doc-id-novo' }) },
    )
    expect(storage.enviarCapaPng).toHaveBeenCalledWith(
      `livros/${CONTA_A.id}/pasta-antiga/capa.png`,
      expect.any(String),
    )
  })

  it('livro criado agora nasce com documento e pasta no mesmo id', async () => {
    vi.mocked(firestore.contarLivrosDoDono).mockResolvedValue(0)
    vi.mocked(firestore.slugEmUsoNaConta).mockResolvedValue(false)
    vi.mocked(storage.enviarCapaPng).mockResolvedValue(false)
    vi.mocked(firestore.criarLivro).mockResolvedValue(livroFalso())
    const { POST } = await import('@/app/api/conta/livros/route')
    await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({ titulo: 'Novo', livro_id: 'id-da-sessao' }),
      }),
    )
    expect(firestore.criarLivro).toHaveBeenCalledWith(
      'id-da-sessao',
      expect.objectContaining({
        arquivo_pdf_caminho: `livros/${CONTA_A.id}/id-da-sessao/original.pdf`,
      }),
    )
  })
})

describe('limite do plano — regra 11.8', () => {
  it('recusa criar o sexto livro numa conta gratuita, e não escreve nada', async () => {
    vi.mocked(firestore.contarLivrosDoDono).mockResolvedValue(5)
    const { POST } = await import('@/app/api/conta/livros/route')
    const resposta = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({ titulo: 'Sexto', livro_id: 'novo' }),
      }),
    )
    expect(resposta.status).toBe(409)
    await expect(resposta.json()).resolves.toMatchObject({
      erro: 'Você chegou ao limite de 5 livros.',
    })
    expect(firestore.criarLivro).not.toHaveBeenCalled()
  })

  it('recusa abrir sessão de upload numa conta cheia — o Storage não é tocado', async () => {
    vi.mocked(firestore.contarLivrosDoDono).mockResolvedValue(5)
    const { POST } = await import('@/app/api/conta/livros/sessao-upload/route')
    const resposta = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({ mimeType: 'application/pdf', tamanhoBytes: 1000 }),
      }),
    )
    expect(resposta.status).toBe(409)
    expect(storage.criarSessaoDeUpload).not.toHaveBeenCalled()
  })

  it('conta ilimitada do dono nunca esbarra no limite — regra 11.13', async () => {
    vi.mocked(firestore.garantirUsuario).mockResolvedValue(
      usuarioFalso({ id: CONTA_A.id, plano: 'ilimitado' }),
    )
    vi.mocked(firestore.contarLivrosDoDono).mockResolvedValue(500)
    vi.mocked(firestore.slugEmUsoNaConta).mockResolvedValue(false)
    vi.mocked(storage.enviarCapaPng).mockResolvedValue(false)
    vi.mocked(firestore.criarLivro).mockResolvedValue(livroFalso())
    const { POST } = await import('@/app/api/conta/livros/route')
    const resposta = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({ titulo: 'Quingentésimo primeiro', livro_id: 'novo' }),
      }),
    )
    expect(resposta.status).toBe(201)
  })

  it('rejeita PDF acima de 100 MB antes de tocar no Storage — regra 11.2', async () => {
    vi.mocked(firestore.contarLivrosDoDono).mockResolvedValue(0)
    const { POST } = await import('@/app/api/conta/livros/sessao-upload/route')
    const resposta = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({
          mimeType: 'application/pdf',
          tamanhoBytes: 100 * 1024 * 1024 + 1,
        }),
      }),
    )
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({
      erro: 'Arquivo muito grande (máximo 100 MB).',
    })
    expect(storage.criarSessaoDeUpload).not.toHaveBeenCalled()
  })

  it('rejeita arquivo que não é PDF antes de tocar no Storage', async () => {
    const { POST } = await import('@/app/api/conta/livros/sessao-upload/route')
    const resposta = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({ mimeType: 'image/png', tamanhoBytes: 1000 }),
      }),
    )
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ erro: 'Envie um arquivo PDF.' })
    expect(storage.criarSessaoDeUpload).not.toHaveBeenCalled()
  })
})
