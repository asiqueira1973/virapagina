// Ambiente dos testes.
//
// A allowlist define quem é admin da plataforma e, por consequência, quais contas
// nascem ilimitadas (regra 11.13). As credenciais do Firebase NÃO são definidas
// de propósito: se algum teste conseguir chegar ao Firestore de verdade, a falta
// delas denuncia o vazamento.
process.env.ADMIN_ALLOWED_EMAILS = 'alexandre@dablab.com.br'
process.env.NEXTAUTH_SECRET = 'segredo-de-teste'
process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id-de-teste'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret-de-teste'
process.env.CRON_SECRET = 'cron-de-teste'
// O client OAuth do tipo iOS, que é outro id que o da web: é contra ele que o
// `aud` do id_token do Google é conferido (spec-ios seção 3).
process.env.GOOGLE_OAUTH_IOS_CLIENT_ID = 'ios-client-id-de-teste'
process.env.NEXTAUTH_URL = 'https://virapagina.app.br'
