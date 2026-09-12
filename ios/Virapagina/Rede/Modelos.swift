// Os tipos que espelham o que as rotas devolvem (spec-ios seção 8).
//
// Os nomes dos campos ficam em português, como no Firestore e nos tipos de
// `types/livro.ts`: o que se vê no console do Firebase, o que a rota devolve e o
// que o Swift manipula são a mesma coisa. A conversão de `snake_case` para
// `camelCase` é do decodificador, não de uma lista de CodingKeys escrita à mão —
// uma lista dessas é a primeira coisa a ficar desatualizada.
import Foundation

struct ContaDoApp: Codable, Equatable {
    let id: String
    let email: String
    let nome: String?
    // Nulo até a pessoa escolher o endereço. É este nulo que manda o app para a
    // tela de escolha (critério B.2).
    let handle: String?
    let plano: String
    let rotuloDoPlano: String
    let uso: Uso
    let assinatura: AssinaturaResumo?

    struct Uso: Codable, Equatable {
        let livros: Int
        // Nulo quando o plano não tem limite — early adopter, assinante, dono.
        let limite: Int?
    }

    struct AssinaturaResumo: Codable, Equatable {
        let status: String
        let expiraEm: String?
    }

    // Se a conta pode criar mais um livro. A resposta de verdade é do servidor
    // (regra 11.8); esta é só para decidir se o botão abre o formulário ou o
    // paywall, sem uma ida à rede.
    var podeCriarLivro: Bool {
        guard let limite = uso.limite else { return true }
        return uso.livros < limite
    }

    var temAssinaturaValida: Bool {
        assinatura?.status == "ativa" || assinatura?.status == "em_atraso"
    }
}

struct LivroDoAutor: Codable, Equatable, Identifiable {
    let id: String
    let titulo: String
    let subtitulo: String?
    let slug: String
    let autor: String
    let descricao: String?
    let arquivoPdfTamanhoBytes: Int?
    let totalPaginas: Int?
    let publicado: Bool
    let removidoPorDenuncia: Bool
    let criadoEm: String
    let atualizadoEm: String
    let temCapa: Bool
    // Já vêm prontas do servidor, **com o `?v=`** (regra iOS 10.10). Montá-las
    // aqui seria repetir num idioma onde ninguém vai lembrar da regra.
    let url: String
    let pdfUrl: String
    let capaUrl: String?

    var urlPublica: URL? { URL(string: url) }
    var urlDoPdf: URL? { URL(string: pdfUrl) }
    var urlDaCapa: URL? { capaUrl.flatMap(URL.init(string:)) }
}

struct ListaDeLivros: Codable {
    let livros: [LivroDoAutor]
    let uso: ContaDoApp.Uso
}

// O corpo do formulário, usado tanto ao criar quanto ao editar.
struct MetadadosDoLivro: Equatable {
    var titulo = ""
    var subtitulo = ""
    var slug = ""
    var autor = ""
    var descricao = ""

    init() {}

    init(de livro: LivroDoAutor) {
        titulo = livro.titulo
        subtitulo = livro.subtitulo ?? ""
        slug = livro.slug
        autor = livro.autor
        descricao = livro.descricao ?? ""
    }
}
