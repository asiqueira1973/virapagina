'use client'

// Controles de zoom da barra de ferramentas do leitor (regra 11.5 e critério 8.4):
// de 75% a 250%, em passos de 25%, começando em 100%. Os limites são fixos — não
// há passo intermediário nem valor fora dessa faixa.
export const ZOOM_MINIMO = 0.75
export const ZOOM_MAXIMO = 2.5
export const ZOOM_PASSO = 0.25
export const ZOOM_INICIAL = 1

// Aplica um passo de zoom respeitando os limites. Fora deste arquivo ninguém
// mexe no valor do zoom.
export function ajustarZoom(atual: number, passos: number): number {
  const proximo = atual + passos * ZOOM_PASSO
  const limitado = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, proximo))
  // Arredonda para o passo mais próximo para não acumular erro de ponto flutuante.
  return Math.round(limitado / ZOOM_PASSO) * ZOOM_PASSO
}
