// Testes de integração da camada de dados contra o emulador do Firebase.
//
// Diferente dos outros testes, estes falam com um Firestore e um Storage de
// verdade — os locais. É o que permite verificar o que mock nenhum verifica: que
// a transação de handle realmente impede dois donos para o mesmo nome, que a
// contagem por dono usa o índice certo, e que apagar o livro apaga os arquivos.
//
// Rodam só quando o emulador está no ar (`npm run emu`); sem ele, são pulados,
// para que `npm test` continue funcionando em qualquer máquina.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const emuladorNoAr = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const descreve = emuladorNoAr ? describe : describe.skip

descreve('camada de dados no emulador', () => {
  let firestore: typeof import('@/lib/firebase/firestore')
  let storage: typeof import('@/lib/firebase/storage')

  // Cada execução usa ids próprios, para os testes não brigarem entre si nem com
  // o que ficou de uma execução anterior no emulador.
  const marca = `t${Date.now()}`
  const idAdmin = `${marca}-admin`
  const idComum = `${marca}-comum`
  const handleAdmin = `${marca}-alexandre`
  const handleComum = `${marca}-maria`

  beforeAll(async () => {
    process.env.ADMIN_ALLOWED_EMAILS = 'alexandre@dablab.com.br'
    // Os testes de conta abaixo ligam e desligam esta chave; o padrão é ligado.
    process.env.EARLY_ADOPTER_ABERTO = 'true'
    firestore = await import('@/lib/firebase/firestore')
    storage = await import('@/lib/firebase/storage')
  })

  afterAll(async () => {
    // Limpa o que este teste criou, para o emulador não virar um depósito.
    for (const livro of await firestore.listarLivrosDoDono(idAdmin)) {
      await firestore.excluirLivro(livro.id)
      await storage.apagarPastaDoLivro(idAdmin, livro.id)
    }
    for (const livro of await firestore.listarLivrosDoDono(idComum)) {
      await firestore.excluirLivro(livro.id)
    }
    process.env.EARLY_ADOPTER_ABERTO = 'true'
  })

  describe('contas — regra 11.13', () => {
    it('conta com e-mail de admin nasce ilimitada', async () => {
      const conta = await firestore.garantirUsuario({
        id: idAdmin,
        email: 'alexandre@dablab.com.br',
        nome: 'Alexandre',
      })
      expect(conta.plano).toBe('ilimitado')
    })

    it('com a plataforma aberta, conta comum nasce early adopter', async () => {
      const conta = await firestore.garantirUsuario({
        id: idComum,
        email: 'maria@exemplo.com',
        nome: 'Maria',
      })
      expect(conta.plano).toBe('early_adopter')
      expect(conta.handle).toBeNull()
    })

    it('o plano do dono é reaplicado a cada login, mesmo se alguém o rebaixar', async () => {
      await firestore.alterarPlano(idAdmin, 'gratuito')
      const conta = await firestore.garantirUsuario({
        id: idAdmin,
        email: 'alexandre@dablab.com.br',
        nome: 'Alexandre',
      })
      expect(conta.plano).toBe('ilimitado')
    })

    it('a regra do dono vence a do early adopter', async () => {
      // Um e-mail da plataforma, criado com a chave ligada, nasce ilimitado —
      // não early adopter (regra 11.14, ordem das regras).
      const id = `${marca}-dono-2`
      const conta = await firestore.garantirUsuario({
        id,
        email: 'alexandre@dablab.com.br',
        nome: 'Alexandre',
      })
      expect(conta.plano).toBe('ilimitado')
    })
  })

  // O teste que prova o "vitalício" da regra 11.14, nos dois sentidos.
  describe('early adopter é vitalício — regra 11.14', () => {
    const idAntes = `${marca}-entrou-antes`
    const idDepois = `${marca}-entrou-depois`

    it('com a chave ligada, a conta nova nasce early adopter', async () => {
      process.env.EARLY_ADOPTER_ABERTO = 'true'
      const conta = await firestore.garantirUsuario({
        id: idAntes,
        email: 'antes@exemplo.com',
        nome: 'Antes',
      })
      expect(conta.plano).toBe('early_adopter')
    })

    it('desligar a chave NÃO rebaixa quem já entrou, nem no login seguinte', async () => {
      process.env.EARLY_ADOPTER_ABERTO = 'false'
      const conta = await firestore.garantirUsuario({
        id: idAntes,
        email: 'antes@exemplo.com',
        nome: 'Antes',
      })
      expect(conta.plano).toBe('early_adopter')
    })

    it('com a chave desligada, a conta nova nasce gratuita', async () => {
      process.env.EARLY_ADOPTER_ABERTO = 'false'
      const conta = await firestore.garantirUsuario({
        id: idDepois,
        email: 'depois@exemplo.com',
        nome: 'Depois',
      })
      expect(conta.plano).toBe('gratuito')
    })

    it('religar a chave NÃO promove quem entrou depois', async () => {
      process.env.EARLY_ADOPTER_ABERTO = 'true'
      const conta = await firestore.garantirUsuario({
        id: idDepois,
        email: 'depois@exemplo.com',
        nome: 'Depois',
      })
      expect(conta.plano).toBe('gratuito')
    })
  })

  describe('handles — a transação da seção 7', () => {
    it('reserva o handle e o grava na conta', async () => {
      expect(await firestore.reservarHandle(idAdmin, handleAdmin)).toBe(true)
      const achado = await firestore.buscarUsuarioPorHandle(handleAdmin)
      expect(achado?.id).toBe(idAdmin)
    })

    it('o segundo a pedir o mesmo handle perde — nunca os dois vencem', async () => {
      expect(await firestore.reservarHandle(idComum, handleAdmin)).toBe(false)
    })

    it('recusa handle reservado do produto', async () => {
      expect(await firestore.reservarHandle(idComum, 'admin')).toBe(false)
      expect(await firestore.reservarHandle(idComum, 'termos')).toBe(false)
    })

    it('o dono não redefine o próprio handle — regra 11.10', async () => {
      expect(await firestore.reservarHandle(idComum, handleComum)).toBe(true)
      expect(await firestore.reservarHandle(idComum, `${marca}-outro`)).toBe(false)
    })

    it('sugere um handle livre quando o pedido está ocupado', async () => {
      const sugestao = await firestore.sugerirHandleLivre(handleAdmin)
      expect(sugestao).toBe(`${handleAdmin}-2`)
    })

    it('o admin da plataforma troca o handle, liberando o antigo', async () => {
      const novo = `${marca}-trocado`
      expect(await firestore.trocarHandle(idComum, novo)).toBe(true)
      expect((await firestore.buscarUsuarioPorHandle(novo))?.id).toBe(idComum)
      // O antigo volta a ficar livre.
      expect(await firestore.handleDisponivel(handleComum)).toBe(true)
    })
  })

  describe('livros — isolamento por dono', () => {
    const molde = {
      titulo: 'Conceitos de Tecnologia',
      subtitulo: null,
      autor: 'Alexandre Siqueira',
      descricao: null,
      arquivo_pdf_tamanho_bytes: 9_000_000,
      capa_caminho: null,
      total_paginas: 40,
    }

    it('livro nasce rascunho e não removido', async () => {
      const livro = await firestore.criarLivro(`${marca}-livro-a`, {
        ...molde,
        dono_id: idAdmin,
        slug: 'conceitos',
        arquivo_pdf_caminho: storage.caminhoDoPdf(idAdmin, `${marca}-livro-a`),
      })
      expect(livro.publicado).toBe(false)
      expect(livro.removido_por_denuncia).toBe(false)
    })

    // O id do documento é o mesmo da pasta no Storage. Enquanto não era, trocar o
    // PDF escrevia numa pasta que o leitor nunca abre (critério 8.2).
    it('o id do documento é o id que a sessão de upload usou na pasta', async () => {
      const id = `${marca}-livro-id`
      const livro = await firestore.criarLivro(id, {
        ...molde,
        dono_id: idAdmin,
        slug: 'com-id-proprio',
        arquivo_pdf_caminho: storage.caminhoDoPdf(idAdmin, id),
      })
      expect(livro.id).toBe(id)
      expect(livro.arquivo_pdf_caminho).toContain(`/${id}/`)
      expect((await firestore.buscarLivroPorId(id))?.slug).toBe('com-id-proprio')
    })

    it('slug igual em OUTRA conta é aceito — o namespace é por autor', async () => {
      const livro = await firestore.criarLivro(`${marca}-livro-b`, {
        ...molde,
        dono_id: idComum,
        slug: 'conceitos',
        arquivo_pdf_caminho: storage.caminhoDoPdf(idComum, `${marca}-livro-b`),
      })
      expect(livro.slug).toBe('conceitos')
      expect(await firestore.slugEmUsoNaConta(idAdmin, 'conceitos')).toBe(true)
      expect(await firestore.slugEmUsoNaConta(`${marca}-terceiro`, 'conceitos')).toBe(false)
    })

    it('a listagem e a contagem só enxergam os livros do próprio dono', async () => {
      const doAdmin = await firestore.listarLivrosDoDono(idAdmin)
      expect(doAdmin).toHaveLength(1)
      expect(doAdmin.every((livro) => livro.dono_id === idAdmin)).toBe(true)
      expect(await firestore.contarLivrosDoDono(idAdmin)).toBe(1)
      expect(await firestore.contarLivrosDoDono(idComum)).toBe(1)
    })

    it('a busca por dono e slug não cruza contas', async () => {
      const doAdmin = await firestore.buscarLivroPorDonoESlug(idAdmin, 'conceitos')
      const doComum = await firestore.buscarLivroPorDonoESlug(idComum, 'conceitos')
      expect(doAdmin?.dono_id).toBe(idAdmin)
      expect(doComum?.dono_id).toBe(idComum)
      expect(doAdmin?.id).not.toBe(doComum?.id)
    })

    it('sugere -2 quando o slug já existe na conta', async () => {
      expect(await firestore.sugerirSlugLivreNaConta(idAdmin, 'conceitos')).toBe('conceitos-2')
      // Ignorando o próprio livro, o slug continua sendo dele.
      const livro = await firestore.buscarLivroPorDonoESlug(idAdmin, 'conceitos')
      expect(await firestore.sugerirSlugLivreNaConta(idAdmin, 'conceitos', livro!.id)).toBe(
        'conceitos',
      )
    })

    it('atualizar reescreve atualizado_em — não existe trigger', async () => {
      const antes = await firestore.buscarLivroPorDonoESlug(idAdmin, 'conceitos')
      await new Promise((resolver) => setTimeout(resolver, 10))
      const depois = await firestore.atualizarLivro(antes!.id, { publicado: true })
      expect(depois?.publicado).toBe(true)
      expect(depois?.atualizado_em).not.toBe(antes?.atualizado_em)
    })
  })

  describe('arquivos e tráfego', () => {
    it('sobe a capa, lê de volta com o tamanho, e some ao apagar a pasta', async () => {
      const livro = (await firestore.listarLivrosDoDono(idAdmin))[0]
      const caminho = storage.caminhoDaCapa(idAdmin, livro.id)
      const png = `data:image/png;base64,${Buffer.from('conteudo-de-teste').toString('base64')}`

      expect(await storage.enviarCapaPng(caminho, png)).toBe(true)
      const baixado = await storage.baixarArquivo(caminho)
      expect(baixado?.tamanhoBytes).toBe(17)
      expect(baixado?.mimeType).toBe('image/png')

      await storage.apagarPastaDoLivro(idAdmin, livro.id)
      expect(await storage.baixarArquivo(caminho)).toBeNull()
    })

    it('capa vazia não vira arquivo — livro sem capa é estado previsto', async () => {
      expect(await storage.enviarCapaPng('livros/x/y/capa.png', null)).toBe(false)
      expect(await storage.enviarCapaPng('livros/x/y/capa.png', '')).toBe(false)
    })

    it('arquivo inexistente devolve null em vez de estourar', async () => {
      expect(await storage.baixarArquivo('livros/nao/existe/original.pdf')).toBeNull()
    })

    it('o contador de tráfego soma e sobrevive a chamadas seguidas — regra 11.11', async () => {
      await firestore.somarTrafego(idComum, 5_000)
      await firestore.somarTrafego(idComum, 3_000)
      const conta = await firestore.buscarUsuarioPorId(idComum)
      expect(conta?.trafego_mes_bytes).toBe(8_000)
      expect(conta?.trafego_mes_referencia).toBe(new Date().toISOString().slice(0, 7))
    })
  })
})
