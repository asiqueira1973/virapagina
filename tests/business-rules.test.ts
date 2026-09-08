// Regras de negócio da seção 11 e os limites do critério 8.2, testados sem
// depender do Google. São as regras que, se mudarem sozinhas, quebram o produto
// em silêncio.
import { describe, expect, it } from 'vitest'
import { nomeArquivoDownload, ordenarPorCriadoEmDesc, toLivroPublico } from '@/lib/books'
import { proximoSlugLivre, slugValido, slugify } from '@/lib/slug'
import type { Livro } from '@/types/livro'
import { mockNextAuth } from './helpers'

mockNextAuth()

describe('slug gerado a partir do título — regra 11.3', () => {
  it('tira acento, deixa minúsculo e junta com hífen', () => {
    expect(slugify('Conceitos de Tecnologia para Pessoas Executivas e Não Técnicas')).toBe(
      'conceitos-de-tecnologia-para-pessoas-executivas-e-nao-tecnicas',
    )
  })

  it('descarta pontuação e não deixa hífen sobrando nas pontas', () => {
    expect(slugify('  I See Life — edição #3!  ')).toBe('i-see-life-edicao-3')
  })

  it('o que sai do slugify é sempre um slug válido para a URL', () => {
    for (const titulo of ['Ação & Reação', 'ÍNDICE 2026', 'a  b   c']) {
      expect(slugValido(slugify(titulo))).toBe(true)
    }
  })
})

describe('formato do slug aceito — seção 7', () => {
  it('aceita só minúsculas, números e hífen', () => {
    expect(slugValido('meu-livro-2')).toBe(true)
    expect(slugValido('MeuLivro')).toBe(false)
    expect(slugValido('meu livro')).toBe(false)
    expect(slugValido('meu_livro')).toBe(false)
    expect(slugValido('')).toBe(false)
  })
})

describe('validação do arquivo no navegador — critério 8.2 e regra 11.2', () => {
  it('recusa arquivo que não é PDF com a copy exata da seção 14–15', async () => {
    const { validarArquivoPdf } = await import('@/hooks/useBookUpload')
    const arquivo = new File(['x'], 'foto.png', { type: 'image/png' })
    expect(validarArquivoPdf(arquivo)).toBe('Envie um arquivo PDF.')
  })

  it('aceita PDF dentro do limite', async () => {
    const { validarArquivoPdf } = await import('@/hooks/useBookUpload')
    const arquivo = new File(['x'], 'livro.pdf', { type: 'application/pdf' })
    expect(validarArquivoPdf(arquivo)).toBeNull()
  })

  it('recusa PDF acima de 100 MB com a copy exata', async () => {
    const { validarArquivoPdf } = await import('@/hooks/useBookUpload')
    const arquivo = new File(['x'], 'livro.pdf', { type: 'application/pdf' })
    // 100 MB + 1 byte: o limite da regra 11.2 é inclusivo até 100 MB.
    Object.defineProperty(arquivo, 'size', { value: 100 * 1024 * 1024 + 1 })
    expect(validarArquivoPdf(arquivo)).toBe('Arquivo muito grande (máximo 100 MB).')
  })

  it('aceita exatamente 100 MB', async () => {
    const { validarArquivoPdf } = await import('@/hooks/useBookUpload')
    const arquivo = new File(['x'], 'livro.pdf', { type: 'application/pdf' })
    Object.defineProperty(arquivo, 'size', { value: 100 * 1024 * 1024 })
    expect(validarArquivoPdf(arquivo)).toBeNull()
  })
})

describe('sugestão de slug alternativo — critério 8.2', () => {
  it('devolve o próprio slug quando ninguém o usa', () => {
    expect(proximoSlugLivre('i-see-life', [])).toBe('i-see-life')
  })

  it('sugere -2 quando o slug está ocupado', () => {
    expect(proximoSlugLivre('i-see-life', ['i-see-life'])).toBe('i-see-life-2')
  })

  it('pula para -3 quando o -2 também está ocupado', () => {
    expect(proximoSlugLivre('i-see-life', ['i-see-life', 'i-see-life-2'])).toBe('i-see-life-3')
  })
})

describe('nome do arquivo baixado — critério 8.4', () => {
  it('usa o título do livro, não o id interno do Drive', () => {
    expect(nomeArquivoDownload('Conceitos de Tecnologia')).toBe('Conceitos de Tecnologia.pdf')
  })

  it('tira os caracteres que quebram nome de arquivo', () => {
    expect(nomeArquivoDownload('I See Life: edição 3/2026')).toBe('I See Life edição 32026.pdf')
  })
})

describe('ordenação do catálogo — critério 8.5', () => {
  it('coloca o mais recente primeiro', () => {
    const ordenados = ordenarPorCriadoEmDesc([
      livroFalso({ id: 'velho', criado_em: '2026-01-01T00:00:00.000Z' }),
      livroFalso({ id: 'novo', criado_em: '2026-09-01T00:00:00.000Z' }),
      livroFalso({ id: 'meio', criado_em: '2026-05-01T00:00:00.000Z' }),
    ])
    expect(ordenados.map((livro) => livro.id)).toEqual(['novo', 'meio', 'velho'])
  })
})

describe('o que sai do servidor para o público — seção 4', () => {
  it('não leva os ids do Drive nem o e-mail de quem criou', () => {
    const publico = toLivroPublico(livroFalso())
    expect(publico).not.toHaveProperty('arquivo_pdf_drive_id')
    expect(publico).not.toHaveProperty('capa_drive_id')
    expect(publico).not.toHaveProperty('criado_por')
    expect(publico.tem_capa).toBe(true)
  })
})

function livroFalso(sobrescritas: Partial<Livro> = {}): Livro {
  return {
    id: 'id-1',
    titulo: 'Livro',
    subtitulo: null,
    slug: 'livro',
    autor: 'Alexandre Siqueira',
    descricao: null,
    arquivo_pdf_drive_id: 'drive-pdf',
    arquivo_pdf_tamanho_bytes: 100,
    capa_drive_id: 'drive-capa',
    total_paginas: 10,
    publicado: 'sim',
    criado_por: 'alexandre.silva.siqueira@gmail.com',
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}
