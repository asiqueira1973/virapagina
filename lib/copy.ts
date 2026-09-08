// Copy final da interface, exatamente como está na tabela da seção 14–15 do spec.
// Fica num arquivo só para que nenhuma tela reescreva um texto com outras
// palavras — a copy é decisão de produto, não de implementação.
export const COPY = {
  // Catálogo vazio (critério 8.5)
  catalogoVazio: 'Nenhum livro publicado ainda.',
  // Lista do admin vazia (critério 8.2)
  listaAdminVazia: 'Nenhum livro ainda.',
  // Login com e-mail fora da allowlist (critério 8.1)
  acessoNegado: 'Esse e-mail não tem acesso ao painel.',
  // Slug já usado por outro livro (critério 8.2)
  slugDuplicado: 'Esse link já está em uso, escolha outro.',
  // Arquivo selecionado não é PDF (critério 8.2)
  uploadNaoPdf: 'Envie um arquivo PDF.',
  // Arquivo acima do limite da regra 11.2
  uploadGrandeDemais: 'Arquivo muito grande (máximo 100 MB).',
  // Confirmação de exclusão, nomeando o livro (critério 8.2)
  confirmarExclusao: (titulo: string) =>
    `Excluir "${titulo}"? Essa ação não pode ser desfeita.`,
  // Aviso ao mudar o slug de um livro já publicado (critério 8.2)
  avisoTrocaDeSlug:
    'Isso muda o link público. Quem tinha o link antigo vai receber página não encontrada. Continuar?',
  // Confirmação do botão compartilhar sem Web Share API (critério 8.4)
  linkCopiado: 'Link copiado.',
  // 404 público do leitor (critério 8.3)
  livroIndisponivel: 'Esse livro não está disponível.',
  // Falha no envio do arquivo (fluxo de exceção da seção 9)
  erroDeUpload: 'Não foi possível concluir o envio. Tente novamente.',
  // Qualquer falha de integração com o Google (fluxo de exceção da seção 9)
  erroGenerico: 'Algo deu errado. Tente novamente em instantes.',
} as const
