// O endereço público da plataforma, num lugar só.
//
// Três telas mostram o domínio ao usuário — a escolha do endereço, a vitrine e o
// detalhe da conta no painel — e uma delas é o momento em que a pessoa decide um
// identificador permanente. Escrever o domínio à mão em cada uma faz as três
// mentirem no dia em que ele mudar, ou enquanto o deploy ainda estiver na URL
// provisória da Vercel.
//
// A fonte é `NEXTAUTH_URL`, que já precisa estar certa para o login funcionar:
// se ela estiver errada, o problema aparece antes, no lugar certo.

// URL canônica, com protocolo. Usada nos metadados e nos links absolutos.
export function urlDoSite(): string {
  return (process.env.NEXTAUTH_URL ?? 'https://virapagina.app.br').replace(/\/+$/, '')
}

// Só o domínio, sem protocolo e sem barra final — é assim que ele aparece na
// interface, ao lado do handle: `virapagina.app.br/alexandre`.
export function dominioDoSite(): string {
  try {
    return new URL(urlDoSite()).host
  } catch {
    // NEXTAUTH_URL malformada não pode derrubar uma página inteira.
    return 'virapagina.app.br'
  }
}
