// A copy da interface, exatamente como na seção 15 do spec e em `lib/copy.ts`
// (spec-ios seção 6).
//
// Existe pelo mesmo motivo do arquivo da web: texto de produto não é decisão de
// implementação, e nenhuma tela pode reescrevê-lo com outras palavras. O app e o
// site dizem a mesma coisa nas mesmas situações — quem usa os dois não pode
// achar que são dois produtos.
enum Copy {
    // --- Vindos da web, palavra por palavra ---
    static let listaVazia = "Nenhum livro ainda."
    static let handleInvalido = "Use de 3 a 30 letras minúsculas, números ou hífen."
    static let handleIndisponivel = "Esse endereço já está em uso, escolha outro."
    static let handleDefinitivo = "O endereço não pode ser alterado depois. Para trocar, fale com o suporte."
    static let slugDuplicado = "Esse link já está em uso, escolha outro."
    static let uploadNaoPdf = "Envie um arquivo PDF."
    static let uploadGrandeDemais = "Arquivo muito grande (máximo 100 MB)."
    static let erroDeUpload = "Não foi possível concluir o envio. Tente novamente."
    static let erroGenerico = "Algo deu errado. Tente novamente em instantes."
    static let linkCopiado = "Link copiado."
    static let avisoTrocaDeSlug =
        "Isso muda o link público. Quem tinha o link antigo vai receber página não encontrada. Continuar?"
    static let livroRemovido =
        "Este livro foi despublicado por violar os termos de uso. Fale com o suporte."

    static func limiteAtingido(_ limite: Int) -> String { "Você chegou ao limite de \(limite) livros." }
    static func confirmarExclusao(_ titulo: String) -> String {
        "Excluir \"\(titulo)\"? Essa ação não pode ser desfeita."
    }

    // --- Do app ---
    static let entrarBotao = "Entrar com Google"
    static let entrarRodape = "Sua conta é criada automaticamente no primeiro acesso."
    static let entrarFrase = "Seus PDFs viram livros que qualquer pessoa folheia pelo link."
    static let entrarErro = "Não foi possível entrar. Tente novamente."
    static let semRede = "Sem conexão. Verifique a internet e tente de novo."
    static let naoConfigurado =
        "O app ainda não tem um client do Google configurado. Preencha ios/Configuracao.xcconfig."

    static let paywallTitulo = "Livros ilimitados"
    static let paywallLinha1 = "Quantos livros você quiser, sem limite de páginas."
    static let paywallLinha2 = "Sem marca d'água, hoje e sempre."
    static let paywallLinha3 = "Cancele quando quiser, direto na App Store."
    static let paywallTranquilidade =
        "Os livros que você já publicou continuam no ar mesmo se você cancelar."
    static let paywallRestaurar = "Restaurar compras"
    static let paywallSemAssinatura = "Nenhuma assinatura ativa encontrada."

    static let contaExcluirTitulo = "Excluir conta"
    static let contaExcluirAviso =
        "Isso apaga sua conta, seus livros e os arquivos enviados. Os links públicos param de funcionar. Não há como desfazer."
    static let contaExcluirConfirmacao = "Digite seu endereço para confirmar."

    static let previaDeRascunho = "prévia de rascunho"
}
