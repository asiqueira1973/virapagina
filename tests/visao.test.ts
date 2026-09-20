// Instrumentação do Visão de Produto. O que estes testes protegem não é a
// métrica: é a promessa de que medir o produto nunca derruba o produto.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEITOR_ANONIMO, registrarEvento } from '@/lib/visao'

// O envio sai do fluxo de quem chamou, de propósito. Um tique do event loop é o
// suficiente para ele acontecer — e é o que o teste espera no lugar de um await
// que a função, por desenho, não oferece.
const umTique = () => new Promise((resolva) => setTimeout(resolva, 0))

const EVENTO = {
  nome: 'livro_publicado',
  quem: 'ana@exemplo.com',
  tela: 'EditarLivro',
  descricao: 'publicou o livro',
  propriedades: { total_paginas: 44 },
} as const

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  delete process.env.VISAO_API_KEY
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sem chave configurada', () => {
  it('não envia nada — desenvolvimento e teste não sujam o painel', async () => {
    registrarEvento(EVENTO)
    await umTique()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('trata chave vazia como ausente, como o resto do projeto', async () => {
    process.env.VISAO_API_KEY = '   '
    registrarEvento(EVENTO)
    await umTique()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('com chave configurada', () => {
  beforeEach(() => {
    process.env.VISAO_API_KEY = 'ing_de-teste'
  })

  it('manda um evento com o prefixo do produto, a chave no cabeçalho e quem agiu', async () => {
    registrarEvento(EVENTO)
    await umTique()

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, opcoes] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.visaodeproduto.com.br/functions/v1/ingest')
    expect((opcoes.headers as Record<string, string>)['x-api-key']).toBe('ing_de-teste')

    const { eventos } = JSON.parse(String(opcoes.body))
    expect(eventos).toHaveLength(1)
    expect(eventos[0].nome).toBe('vira_pagina_livro_publicado')
    expect(eventos[0].distinct_id).toBe('ana@exemplo.com')
    expect(eventos[0].tela).toBe('EditarLivro')
    expect(eventos[0].propriedades).toEqual({ total_paginas: 44 })
    // Sem milissegundo, no formato do exemplo da API.
    expect(eventos[0].ocorrido_em).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(eventos[0].id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('a leitura pública vai sob um distinct_id anônimo — quem folheia não tem conta', async () => {
    registrarEvento({
      nome: 'livro_lido',
      quem: LEITOR_ANONIMO,
      tela: 'Leitor',
      descricao: 'abriu um livro público',
    })
    await umTique()

    const { eventos } = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
    expect(eventos[0].distinct_id).toBe('leitor-anonimo')
    // Sem propriedades, a chave nem é enviada.
    expect(eventos[0]).not.toHaveProperty('propriedades')
  })

  it('não lança quando a ponta recusa o evento', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('não', { status: 500 })))
    expect(() => registrarEvento(EVENTO)).not.toThrow()
    await umTique()
    expect(console.error).toHaveBeenCalled()
  })

  it('não lança quando a ponta está fora do ar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede caiu') }))
    expect(() => registrarEvento(EVENTO)).not.toThrow()
    await umTique()
    expect(console.error).toHaveBeenCalled()
  })
})
