// Duplos usados pelos testes de autorização e visibilidade.
//
// O Firestore e o Storage são substituídos por espiões: os testes precisam
// afirmar não só o código de resposta, mas **que nada foi tocado** numa
// requisição não autorizada. Sem isso, uma rota poderia devolver 404 depois de
// já ter lido — ou escrito — dado de outra conta.
import { vi } from 'vitest'
import type { Livro, Usuario } from '@/types/livro'

// Sessão corrente que o mock de `auth()` devolve. Cada teste ajusta este valor.
export const sessaoAtualDoTeste: {
  valor: { user?: { id?: string; email?: string | null; name?: string | null } } | null
} = { valor: null }

// Faz o `auth()` do Auth.js devolver a sessão que o teste configurou, sem sair
// para a rede. As guardas continuam sendo o código real — são elas que estão
// sendo testadas (seção 22).
export function mockNextAuth() {
  vi.mock('next-auth', () => ({
    default: () => ({
      handlers: { GET: vi.fn(), POST: vi.fn() },
      auth: async () => sessaoAtualDoTeste.valor,
      signIn: vi.fn(),
      signOut: vi.fn(),
    }),
  }))
  vi.mock('next-auth/providers/google', () => ({ default: () => ({ id: 'google' }) }))
}

// Substitui as duas camadas que falam com o Google.
export function mockFirebase() {
  vi.mock('@/lib/firebase/firestore', () => ({
    FORMATO_DE_HANDLE: /^[a-z0-9-]{3,30}$/,
    HANDLES_RESERVADOS: ['admin', 'api', 'termos'],
    garantirUsuario: vi.fn(),
    buscarUsuarioPorId: vi.fn(),
    buscarUsuarioPorHandle: vi.fn(),
    listarUsuarios: vi.fn(),
    handleDisponivel: vi.fn(),
    sugerirHandleLivre: vi.fn(),
    reservarHandle: vi.fn(),
    trocarHandle: vi.fn(),
    alterarPlano: vi.fn(),
    somarTrafego: vi.fn(),
    listarLivrosDoDono: vi.fn(),
    contarLivrosDoDono: vi.fn(),
    buscarLivroPorId: vi.fn(),
    buscarLivroPorDonoESlug: vi.fn(),
    slugEmUsoNaConta: vi.fn(),
    sugerirSlugLivreNaConta: vi.fn(),
    criarLivro: vi.fn(),
    atualizarLivro: vi.fn(),
    excluirLivro: vi.fn(),
    registrarAcaoAdmin: vi.fn(),
  }))
  vi.mock('@/lib/firebase/storage', () => ({
    caminhoDoPdf: (dono: string, livro: string) => `livros/${dono}/${livro}/original.pdf`,
    caminhoDaCapa: (dono: string, livro: string) => `livros/${dono}/${livro}/capa.png`,
    criarSessaoDeUpload: vi.fn(),
    enviarCapaPng: vi.fn(),
    baixarArquivo: vi.fn(),
    apagarArquivo: vi.fn(),
    apagarPastaDoLivro: vi.fn(),
  }))
}

// --- Estados de sessão ---

export function semSessao() {
  sessaoAtualDoTeste.valor = null
}

export function sessaoDe(id: string, email: string) {
  sessaoAtualDoTeste.valor = { user: { id, email, name: null } }
}

export const CONTA_A = { id: 'conta-a', email: 'ana@exemplo.com' }
export const CONTA_B = { id: 'conta-b', email: 'bruno@exemplo.com' }
export const CONTA_ADMIN = { id: 'conta-admin', email: 'alexandre@dablab.com.br' }

// --- Moldes ---

export function usuarioFalso(sobrescritas: Partial<Usuario> = {}): Usuario {
  return {
    id: CONTA_A.id,
    email: CONTA_A.email,
    nome: 'Ana',
    handle: 'ana',
    plano: 'gratuito',
    trafego_mes_bytes: 0,
    trafego_mes_referencia: new Date().toISOString().slice(0, 7),
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}

export function livroFalso(sobrescritas: Partial<Livro> = {}): Livro {
  return {
    id: 'livro-1',
    dono_id: CONTA_A.id,
    titulo: 'Conceitos de Tecnologia',
    subtitulo: null,
    slug: 'conceitos',
    autor: 'Ana',
    descricao: null,
    arquivo_pdf_caminho: `livros/${CONTA_A.id}/livro-1/original.pdf`,
    arquivo_pdf_tamanho_bytes: 9_000_000,
    capa_caminho: `livros/${CONTA_A.id}/livro-1/capa.png`,
    total_paginas: 44,
    publicado: false,
    removido_por_denuncia: false,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  }
}
