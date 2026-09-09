// Chaves de funcionalidade da plataforma (spec regra 11.14).
//
// Ficam num arquivo próprio, quase sem imports, porque a criação de conta e as
// telas de admin precisam delas e importariam uma à outra.

// Diz se a plataforma ainda aceita early adopters.
//
// Enquanto for verdadeira, toda conta **criada** nasce `early_adopter`, com
// livros ilimitados para sempre (regra 11.14). Desligá-la muda só quem entra
// dali em diante: **ninguém é rebaixado**, nem quando a cobrança existir.
//
// O padrão é ligado. Uma variável ausente ou escrita errado deixa a plataforma
// aberta, e não fechada: errar para o lado de dar acesso a mais gente é
// recuperável — errar para o lado de negar cria uma leva de contas gratuitas que
// deveriam ter sido vitalícias, e isso não dá para consertar depois sem saber
// quem entrou quando.
import { env } from '@/lib/env'

export function earlyAdopterAberto(): boolean {
  const valor = env('EARLY_ADOPTER_ABERTO', 'true').trim().toLowerCase()
  return valor !== 'false' && valor !== '0' && valor !== 'nao' && valor !== 'não'
}
