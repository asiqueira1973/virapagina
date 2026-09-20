// Eventos de uso para o Visão de Produto — o painel onde o uso do Virapágina é
// acompanhado. Não implementa regra do spec: é instrumentação, e é o único
// módulo que conhece esse serviço.
//
// Quatro decisões que valem o comentário, porque cada uma protege de um jeito
// diferente de quebrar o produto para medir o produto:
//
// 1. **Só no servidor.** A chave é secreta e não pode chegar ao navegador, do
//    mesmo jeito que o Firestore não chega (pegadinha 3 do CLAUDE.md). Toda
//    chamada nasce em rota ou componente de servidor.
// 2. **Nunca derruba nem atrasa a resposta.** O envio acontece depois de a
//    resposta sair, por `after()` do Next, e todo erro morre aqui dentro, no
//    log. Painel de métrica fora do ar não pode impedir ninguém de publicar um
//    livro.
// 3. **Sem chave, não envia.** Desenvolvimento, teste e emulador rodam sem
//    `VISAO_API_KEY` e ficam silenciosos — evento de brincadeira não sobe para
//    o painel de produção.
// 4. **O evento é sempre disparado depois da autorização e depois do sucesso.**
//    Antes da guarda ele mediria tentativa de invasão como uso; antes da
//    escrita, mediria o que não aconteceu.
import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { envOuNulo } from '@/lib/env'

const ENDPOINT = 'https://api.visaodeproduto.com.br/functions/v1/ingest'

// O prefixo separa o Virapágina dos outros produtos no mesmo painel.
const PREFIXO = 'vira_pagina_'

// Quem folheia um livro público não tem conta — e o produto existe justamente
// para essa pessoa. Todas as leituras anônimas entram sob um mesmo
// `distinct_id`: a contagem de leituras continua certa, e a linha do tempo de
// um autor não fica com leituras que não foram dele.
export const LEITOR_ANONIMO = 'leitor-anonimo'

// Os eventos que o produto mede, e nada além deles. A lista fechada é o que
// evita o painel virar um depósito de nomes parecidos — `livro_publicado` e
// `publicou_livro` medindo a mesma coisa.
export type NomeDeEvento =
  | 'conta_criada'
  | 'app_entrou'
  | 'handle_escolhido'
  | 'livro_criado'
  | 'livro_publicado'
  | 'livro_despublicado'
  | 'pdf_substituido'
  | 'livro_excluido'
  | 'livro_lido'
  | 'assinatura_confirmada'

export interface EventoDeUso {
  nome: NomeDeEvento
  // O e-mail de quem agiu, ou `LEITOR_ANONIMO` na leitura pública.
  quem: string
  // A tela de onde a ação partiu, no vocabulário do produto, não da rota.
  tela: string
  descricao: string
  propriedades?: Record<string, unknown>
}

export function registrarEvento(evento: EventoDeUso): void {
  const chave = envOuNulo('VISAO_API_KEY')
  if (!chave) return

  const corpo = JSON.stringify({
    eventos: [
      {
        id: randomUUID(),
        nome: `${PREFIXO}${evento.nome}`,
        distinct_id: evento.quem,
        ocorrido_em: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        tela: evento.tela,
        descricao: evento.descricao,
        ...(evento.propriedades ? { propriedades: evento.propriedades } : {}),
      },
    ],
  })

  depoisDaResposta(async () => {
    try {
      const resposta = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': chave },
        body: corpo,
        // Sem o limite, uma ponta que não responde seguraria a função viva até
        // o teto da plataforma, de graça.
        signal: AbortSignal.timeout(5_000),
      })
      if (!resposta.ok) {
        console.error(`Visão de Produto recusou ${evento.nome}: HTTP ${resposta.status}`)
      }
    } catch (erro) {
      console.error(`Falha ao registrar ${evento.nome} no Visão de Produto:`, erro)
    }
  })
}

// `after()` mantém a função viva depois de a resposta ter saído — é isso que
// evita o serverless matar o envio no meio do caminho. Fora de um ciclo de
// requisição ele lança; nesse caso o envio vira disparo solto, que é o pior
// cenário aceitável: pode se perder, mas não atrapalha ninguém.
function depoisDaResposta(tarefa: () => Promise<void>): void {
  try {
    after(tarefa)
  } catch {
    void tarefa()
  }
}
