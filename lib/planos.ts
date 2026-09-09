// Limites e franquias de cada plano (spec regra 11.8) e a válvula de tráfego
// (regra 11.11). Os números vivem só aqui: nenhuma tela e nenhuma rota repete
// um limite, para que mudar a faixa seja mudar um arquivo.
//
// Os preços NÃO estão aqui de propósito — não há cobrança no v3. Eles vivem no
// EPICO-COBRANCA.md e entram junto com o Stripe.
import type { Plano } from '@/types/livro'

const GB = 1024 * 1024 * 1024

interface DefinicaoDePlano {
  // Quantos livros a conta pode ter no total, rascunho e publicado (assunção
  // 24.1). `null` significa sem limite.
  limiteLivros: number | null
  // Franquia mensal de saída de dados. `null` significa sem franquia — a conta
  // nunca dispara aviso de tráfego.
  franquiaTrafegoBytes: number | null
  // Como o plano aparece na interface.
  rotulo: string
}

export const PLANOS: Record<Plano, DefinicaoDePlano> = {
  gratuito: { limiteLivros: 5, franquiaTrafegoBytes: 20 * GB, rotulo: 'Gratuito' },
  // Quem entrou enquanto a plataforma estava aberta (regra 11.14). Livros
  // ilimitados, para sempre — mas com franquia de tráfego, ao contrário do plano
  // do dono. A franquia não limita nada: ela só avisa (regra 11.11). Sem ela,
  // uma categoria que pode crescer para centenas de contas ficaria sem nenhum
  // alarme contra a fatura do Blaze, que não tem teto (assunção 24.8).
  early_adopter: { limiteLivros: null, franquiaTrafegoBytes: 200 * GB, rotulo: 'Early adopter' },
  ate_20: { limiteLivros: 20, franquiaTrafegoBytes: 50 * GB, rotulo: 'Até 20 livros' },
  ate_50: { limiteLivros: 50, franquiaTrafegoBytes: 100 * GB, rotulo: 'Até 50 livros' },
  ate_100: { limiteLivros: 100, franquiaTrafegoBytes: 200 * GB, rotulo: 'Até 100 livros' },
  // Contas do próprio dono da plataforma (regra 11.13).
  ilimitado: { limiteLivros: null, franquiaTrafegoBytes: null, rotulo: 'Ilimitado' },
}

// Plano de uma conta nova quando nenhuma regra especial se aplica.
export const PLANO_PADRAO: Plano = 'gratuito'

// Plano das contas do dono da plataforma (regra 11.13).
export const PLANO_DO_DONO: Plano = 'ilimitado'

// Plano de quem entra enquanto a plataforma está aberta (regra 11.14).
export const PLANO_EARLY_ADOPTER: Plano = 'early_adopter'

// Planos que o admin da plataforma pode conceder à mão, na ordem em que
// aparecem na tela. `ilimitado` fica de fora de propósito: ele é automático para
// os e-mails da plataforma (regra 11.13) e dá conta sem franquia de tráfego —
// concedê-lo a terceiros tiraria o único alarme contra a fatura do Blaze.
//
// `early_adopter` está na lista porque conceder é um caso real de suporte:
// alguém que criou a conta minutos depois de a chave ser desligada.
export const PLANOS_CONCEDIVEIS: Plano[] = [
  'gratuito',
  'early_adopter',
  'ate_20',
  'ate_50',
  'ate_100',
]

// Diz se um valor vindo do banco é um plano conhecido. Plano desconhecido — de
// uma escrita manual no console, por exemplo — é lido como `gratuito`, que é o
// padrão seguro: erra para menos, nunca para mais.
export function planoValido(valor: unknown): valor is Plano {
  return typeof valor === 'string' && valor in PLANOS
}

// Limite de livros do plano; `null` quando não há limite.
export function limiteDeLivros(plano: Plano): number | null {
  return PLANOS[plano].limiteLivros
}

// Diz se a conta ainda pode criar mais um livro (regra 11.8). O limite conta
// TODOS os livros, rascunho e publicado, porque o custo é o arquivo guardado.
export function temVagaParaNovoLivro(plano: Plano, quantidadeAtual: number): boolean {
  const limite = limiteDeLivros(plano)
  return limite === null || quantidadeAtual < limite
}

// Fração da franquia de tráfego já consumida no mês, de 0 a 1 ou mais.
// Devolve null quando o plano não tem franquia (regra 11.11).
export function fracaoDaFranquia(plano: Plano, bytesNoMes: number): number | null {
  const franquia = PLANOS[plano].franquiaTrafegoBytes
  if (franquia === null || franquia === 0) return null
  return bytesNoMes / franquia
}

// Limiar de aviso ao autor (regra 11.11): 80% da franquia.
export const LIMIAR_AVISO_AUTOR = 0.8

// Limiar de aviso ao dono da plataforma (regra 11.11): franquia estourada.
export const LIMIAR_AVISO_PLATAFORMA = 1
