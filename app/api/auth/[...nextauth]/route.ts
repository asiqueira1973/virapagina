// Rotas de callback do Auth.js para o login com Google (spec seção 6, épico 8.1).
// A configuração inteira mora em lib/google/auth.ts; aqui só expomos os handlers.
import { handlers } from '@/lib/google/auth'

export const { GET, POST } = handlers
