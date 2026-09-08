// Ambiente dos testes: define a allowlist usada pela guarda de admin (seção 5).
// As credenciais do Google não são definidas de propósito — se algum teste
// conseguir chegar ao Sheets ou ao Drive, a falta delas denuncia o vazamento.
process.env.ADMIN_ALLOWED_EMAILS = 'alexandre.silva.siqueira@gmail.com'
process.env.NEXTAUTH_SECRET = 'segredo-de-teste'
process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id-de-teste'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret-de-teste'
