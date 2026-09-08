// Leitura das variáveis de ambiente da integração com o Google (spec seção 18).
// Tudo é lido sob demanda, dentro de função, e nunca no topo do módulo: assim o
// build não quebra num ambiente sem as credenciais e o erro aparece na requisição,
// onde vira o erro genérico da seção 9 ("Algo deu errado. Tente novamente em instantes.").

// Devolve o valor de uma variável obrigatória ou falha alto, com o nome da variável
// no log de servidor — nunca na tela do usuário (seção 20).
function requireEnv(nome: string): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`)
  return valor
}

// Credencial da conta de serviço que lê e escreve na planilha e na pasta do Drive
// (seção 4, assunção 24.4). É o segredo mais sensível do projeto (seção 20) e só
// existe dentro de rota de servidor — nunca é enviada ao navegador.
export function serviceAccountCredentials() {
  return {
    client_email: requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    // A chave privada vem da Vercel com "\n" escapado; o Google exige quebras reais.
    private_key: requireEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n'),
  }
}

// ID da planilha que guarda a aba `livros` (seção 7).
export function sheetId(): string {
  return requireEnv('GOOGLE_SHEET_ID')
}

// ID da pasta do Drive onde ficam os PDFs e as capas (seção 4).
export function driveFolderId(): string {
  return requireEnv('GOOGLE_DRIVE_FOLDER_ID')
}

// Nome da aba da planilha. Fixo em `livros` pela seção 7 — a planilha tem uma aba só.
export const ABA_LIVROS = 'livros'

// Lista de e-mails com acesso ao painel (seção 5: não há tabela de administradores,
// a allowlist é inteiramente a variável de ambiente). Normaliza para minúsculas e
// ignora espaços, para que um erro de digitação na Vercel não tranque o Alexandre fora.
export function adminAllowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

// Confere se um e-mail vindo do Google está na allowlist (seções 5 e 6).
// Um e-mail vazio ou nulo nunca é admin.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminAllowedEmails().includes(email.trim().toLowerCase())
}
