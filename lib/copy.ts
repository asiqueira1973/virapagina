// Copy final da interface, exatamente como está na tabela da seção 15 do spec.
// Fica num arquivo só para que nenhuma tela reescreva um texto com outras
// palavras — a copy é decisão de produto, não de implementação.
import { env } from '@/lib/env'

export const COPY = {
  // Vitrine de um autor sem livros publicados (critério 8.5)
  vitrineVazia: 'Nenhum livro publicado ainda.',
  // Painel do autor sem nenhum livro (critério 8.2)
  listaVazia: 'Nenhum livro ainda.',
  // Limite do plano atingido (regra 11.8)
  limiteAtingido: (limite: number) => `Você chegou ao limite de ${limite} livros.`,
  // Handle fora do formato aceito (critério 8.1)
  handleInvalido: 'Use de 3 a 30 letras minúsculas, números ou hífen.',
  // Handle já tomado ou reservado (critério 8.1)
  handleIndisponivel: 'Esse endereço já está em uso, escolha outro.',
  // Aviso de que a escolha do endereço é definitiva (regra 11.10)
  handleDefinitivo: 'O endereço não pode ser alterado depois. Para trocar, fale com o suporte.',
  // Slug já usado por outro livro da mesma conta (critério 8.2)
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
  // 404 do leitor público (critério 8.3)
  livroIndisponivel: 'Esse livro não está disponível.',
  // 404 da vitrine (critério 8.5)
  autorInexistente: 'Esse endereço não existe.',
  // Falha no envio do arquivo (fluxo de exceção da seção 9)
  erroDeUpload: 'Não foi possível concluir o envio. Tente novamente.',
  // Qualquer falha de integração com o Google (fluxo de exceção da seção 9)
  erroGenerico: 'Algo deu errado. Tente novamente em instantes.',
  // Livro despublicado pelo admin da plataforma (regra 11.12)
  removidoPorDenuncia:
    'Este livro foi despublicado por violar os termos de uso. Fale com o suporte.',
  // Aviso da válvula de tráfego ao autor (regra 11.11)
  avisoDeTrafego:
    'Seus livros foram muito lidos este mês — você já usou 80% da franquia de tráfego. Vamos conversar antes que isso vire um problema.',
} as const

// Endereço de contato dos termos, da privacidade, do canal de denúncia e do
// botão "Falar com a gente" (decisão 25.3).
export function emailDeContato(): string {
  return env('EMAIL_CONTATO', 'alexandre@dablab.com.br')
}

// Responsável pela plataforma, nomeado nos termos (decisão 25.4).
export const RESPONSAVEL = {
  nome: 'DabLab',
  cnpj: '61.033.268/0001-14',
} as const
