// Configuração do Vitest. Os testes da seção 22 rodam em ambiente Node porque
// cobrem rotas de servidor e a guarda de autorização, não interface.
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
