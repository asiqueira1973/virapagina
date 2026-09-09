// A allowlist de administradores da plataforma (spec seções 5 e 6).
//
// Fica num arquivo próprio, sem nenhum import, porque duas camadas precisam dela
// e importariam uma à outra: a autorização (`lib/auth.ts`) e a criação de conta
// (`lib/firebase/firestore.ts`, que aplica a regra 11.13).
//
// Não existe tabela de administradores nem tela de promoção: quem é admin é o que
// estiver em ADMIN_ALLOWED_EMAILS. Adicionar um admin é editar a variável na
// Vercel e refazer o deploy — deliberadamente pouco prático, porque a operação é
// rara e o custo do erro é alto.

// Lê a lista, normalizando para minúsculas e ignorando espaços, para que um
// espaço a mais na Vercel não tranque o dono fora do próprio painel.
export function adminAllowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

// Confere se um e-mail vindo do Google é admin da plataforma. E-mail vazio ou
// nulo nunca é admin.
//
// Esta função responde por duas coisas ao mesmo tempo: quem entra em /admin
// (seção 5) e quais contas nascem com plano ilimitado (regra 11.13). São os
// mesmos e-mails numa lista só, em vez de duas listas para manter em sincronia
// (assunção 24.7).
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminAllowedEmails().includes(email.trim().toLowerCase())
}
