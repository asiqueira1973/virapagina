// Leitura de variável de ambiente que trata **vazio como ausente**.
//
// Existe por causa de um defeito real: `process.env.X ?? padrão` não protege de
// variável definida com valor vazio, porque `''` não é nulo. Painéis como o da
// Vercel criam variáveis vazias com facilidade — importar um `.env.example` já
// faz isso —, e o resultado foi um build quebrado com `TypeError: Invalid URL`,
// vindo de um `new URL('')` a três camadas de distância da causa.
//
// Uma variável vazia quase nunca significa "quero o valor vazio": significa
// "ainda não preenchi". Tratá-la como ausente devolve o padrão, que é o que a
// pessoa esperava.
export function env(nome: string, padrao: string): string {
  const valor = process.env[nome]
  if (valor === undefined || valor.trim() === '') return padrao
  return valor
}

// Versão sem padrão: devolve null quando a variável não foi preenchida.
export function envOuNulo(nome: string): string | null {
  const valor = process.env[nome]
  if (valor === undefined || valor.trim() === '') return null
  return valor
}
