// Regras de negócio da seção 11 e os limites do critério 8.2, testados sem
// depender do Google. São as regras que, se mudarem sozinhas, quebram o produto
// em silêncio.
import { afterEach, describe, expect, it } from 'vitest'
import { livroVisivelPara, nomeArquivoDownload, ordenarPorCriadoEmDesc, toLivroPublico } from '@/lib/books'
import {
  LIMIAR_AVISO_AUTOR,
  LIMIAR_AVISO_PLATAFORMA,
  PLANOS_CONCEDIVEIS,
  fracaoDaFranquia,
  limiteDeLivros,
  planoValido,
  temVagaParaNovoLivro,
} from '@/lib/planos'
import { proximoSlugLivre, slugValido, slugify } from '@/lib/slug'
import { livroFalso, mockNextAuth } from './duplos'

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
  it('não leva os caminhos do Storage nem o dono do livro', () => {
    const publico = toLivroPublico(livroFalso())
    expect(publico).not.toHaveProperty('arquivo_pdf_caminho')
    expect(publico).not.toHaveProperty('capa_caminho')
    expect(publico).not.toHaveProperty('dono_id')
    expect(publico).not.toHaveProperty('removido_por_denuncia')
    expect(publico.tem_capa).toBe(true)
  })
})

describe('limites dos planos — regra 11.8', () => {
  it('o gratuito para em 5 livros', () => {
    expect(limiteDeLivros('gratuito')).toBe(5)
    expect(temVagaParaNovoLivro('gratuito', 4)).toBe(true)
    expect(temVagaParaNovoLivro('gratuito', 5)).toBe(false)
  })

  it('as faixas seguem 20, 50 e 100', () => {
    expect(limiteDeLivros('ate_20')).toBe(20)
    expect(limiteDeLivros('ate_50')).toBe(50)
    expect(limiteDeLivros('ate_100')).toBe(100)
  })

  it('a conta do dono não tem limite nem franquia — regra 11.13', () => {
    expect(limiteDeLivros('ilimitado')).toBeNull()
    expect(temVagaParaNovoLivro('ilimitado', 10_000)).toBe(true)
    expect(fracaoDaFranquia('ilimitado', 999 * 1024 ** 3)).toBeNull()
  })

  it('o early adopter não tem limite de livros, mas mantém franquia — regra 11.14', () => {
    expect(limiteDeLivros('early_adopter')).toBeNull()
    expect(temVagaParaNovoLivro('early_adopter', 10_000)).toBe(true)
    // A franquia existe de propósito: ela não limita nada, só avisa — e é o
    // único alarme contra a fatura do Blaze numa categoria que pode crescer
    // (assunção 24.8).
    expect(fracaoDaFranquia('early_adopter', 100 * 1024 ** 3)).toBeCloseTo(0.5)
  })

  it('`ilimitado` não está entre os planos concedíveis pela tela', () => {
    expect(PLANOS_CONCEDIVEIS).not.toContain('ilimitado')
    expect(PLANOS_CONCEDIVEIS).toContain('early_adopter')
    expect(PLANOS_CONCEDIVEIS).toContain('gratuito')
  })

  it('plano desconhecido não é aceito — o padrão seguro é errar para menos', () => {
    expect(planoValido('gratuito')).toBe(true)
    expect(planoValido('premium')).toBe(false)
    expect(planoValido(undefined)).toBe(false)
  })
})

describe('válvula de tráfego — regra 11.11', () => {
  const GB = 1024 ** 3

  it('mede a fração da franquia consumida', () => {
    expect(fracaoDaFranquia('gratuito', 10 * GB)).toBeCloseTo(0.5)
    expect(fracaoDaFranquia('gratuito', 20 * GB)).toBeCloseTo(1)
  })

  it('os limiares de aviso são 80% para o autor e 100% para a plataforma', () => {
    expect(LIMIAR_AVISO_AUTOR).toBe(0.8)
    expect(LIMIAR_AVISO_PLATAFORMA).toBe(1)
  })
})

describe('visibilidade de um livro — regra 11.4', () => {
  it('publicado é visível para qualquer um, inclusive quem não está logado', () => {
    expect(livroVisivelPara(livroFalso({ publicado: true }), null)).toBe(true)
    expect(livroVisivelPara(livroFalso({ publicado: true }), 'qualquer-um')).toBe(true)
  })

  it('rascunho é visível só para o dono', () => {
    const rascunho = livroFalso({ publicado: false, dono_id: 'conta-a' })
    expect(livroVisivelPara(rascunho, 'conta-a')).toBe(true)
    expect(livroVisivelPara(rascunho, 'conta-b')).toBe(false)
    expect(livroVisivelPara(rascunho, null)).toBe(false)
  })
})

describe('a chave que abre e fecha a plataforma — regra 11.14', () => {
  const original = process.env.EARLY_ADOPTER_ABERTO
  afterEach(() => {
    process.env.EARLY_ADOPTER_ABERTO = original
  })

  it('variável ausente deixa a plataforma aberta', async () => {
    delete process.env.EARLY_ADOPTER_ABERTO
    const { earlyAdopterAberto } = await import('@/lib/flags')
    expect(earlyAdopterAberto()).toBe(true)
  })

  it('fecha só com um "não" explícito', async () => {
    const { earlyAdopterAberto } = await import('@/lib/flags')
    for (const valor of ['false', 'FALSE', '0', 'nao', 'não', ' false ']) {
      process.env.EARLY_ADOPTER_ABERTO = valor
      expect(earlyAdopterAberto()).toBe(false)
    }
  })

  it('qualquer outra coisa mantém aberta — errar para o lado de dar acesso é recuperável', async () => {
    const { earlyAdopterAberto } = await import('@/lib/flags')
    for (const valor of ['true', 'TRUE', 'sim', '1', 'talvez', '']) {
      process.env.EARLY_ADOPTER_ABERTO = valor
      expect(earlyAdopterAberto()).toBe(true)
    }
  })
})

// Regressão de um defeito real: variável definida com valor VAZIO não é a mesma
// coisa que variável ausente, e `?? padrão` não protegia disso. Um
// NEXTAUTH_URL vazio virava `new URL('')` e derrubava o build inteiro, com um
// "Invalid URL" a três camadas de distância da causa.
describe('variável de ambiente vazia se comporta como ausente', () => {
  const originais = { ...process.env }
  afterEach(() => {
    process.env = { ...originais }
  })

  it('NEXTAUTH_URL vazia volta ao padrão em vez de gerar URL inválida', async () => {
    const { urlDoSite, dominioDoSite } = await import('@/lib/site')
    for (const valor of ['', '   ']) {
      process.env.NEXTAUTH_URL = valor
      expect(() => new URL(urlDoSite())).not.toThrow()
      expect(dominioDoSite()).toBe('virapagina.app.br')
    }
  })

  it('EMAIL_CONTATO vazio volta ao padrão', async () => {
    const { emailDeContato } = await import('@/lib/copy')
    process.env.EMAIL_CONTATO = ''
    expect(emailDeContato()).toBe('alexandre@dablab.com.br')
  })

  it('EARLY_ADOPTER_ABERTO vazia mantém a plataforma aberta', async () => {
    const { earlyAdopterAberto } = await import('@/lib/flags')
    process.env.EARLY_ADOPTER_ABERTO = ''
    expect(earlyAdopterAberto()).toBe(true)
  })

  it('ADMIN_ALLOWED_EMAILS vazia não promove ninguém a admin', async () => {
    const { isAdminEmail } = await import('@/lib/admins')
    process.env.ADMIN_ALLOWED_EMAILS = ''
    expect(isAdminEmail('alexandre@dablab.com.br')).toBe(false)
  })
})
