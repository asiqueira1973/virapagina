// O cliente do backend (spec-ios seção 2).
//
// Uma classe só, com um token e um `URLSession`. Nenhuma regra de negócio mora
// aqui: limite de plano, unicidade de handle e de slug, publicação e exclusão são
// decididos pelo servidor (princípio 8 do spec-ios). O app desenha e pede.
//
// Todo erro vira `ErroDaApi`, e a mensagem que ele carrega é **a do servidor**,
// que já está em português e já é a copy da seção 15 — traduzir aqui criaria uma
// segunda cópia dos mesmos textos.
import Foundation

enum ErroDaApi: LocalizedError, Equatable {
    // 401: o token venceu ou foi revogado. Quem trata é a sessão, apagando o
    // token e voltando para a tela de entrar.
    case naoAutenticado
    // 409 com destino /conta/handle: a conta ainda não escolheu endereço.
    case precisaDeHandle
    // 409 do limite do plano (regra 11.8) — é o que abre o paywall.
    case limiteAtingido(String)
    // 409 de slug ou handle em uso, com a sugestão que o servidor calculou.
    case emUso(mensagem: String, sugestao: String?)
    case mensagem(String)
    case semRede

    var errorDescription: String? {
        switch self {
        case .naoAutenticado: return Copy.entrarErro
        case .precisaDeHandle: return Copy.erroGenerico
        case let .limiteAtingido(texto): return texto
        case let .emUso(texto, _): return texto
        case let .mensagem(texto): return texto
        case .semRede: return Copy.semRede
        }
    }
}

// O formato de erro que todas as rotas usam: `{ "erro": "..." }`.
private struct CorpoDeErro: Decodable {
    let erro: String?
    let destino: String?
    let sugestao: String?
    let campo: String?
}

final class Api {
    static let shared = Api()

    // O token do app, guardado no Keychain pela sessão. A Api só o carrega.
    var token: String?

    private let sessao: URLSession = {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForRequest = 30
        // As URLs de PDF e capa já vêm com `?v=` (regra iOS 10.10), então o
        // cache do sistema pode guardá-las à vontade: trocar o arquivo troca a
        // URL. Sem a versão, este cache seria exatamente o defeito que a
        // pegadinha 11 do CLAUDE.md descreve.
        config.requestCachePolicy = .useProtocolCachePolicy
        return URLSession(configuration: config)
    }()

    private let decodificador: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    // -----------------------------------------------------------------------
    // Requisições
    // -----------------------------------------------------------------------

    func requisicao(_ caminho: String, metodo: String = "GET", corpo: [String: Any?]? = nil) -> URLRequest {
        var pedido = URLRequest(url: Configuracao.servidor.appendingPathComponent(caminho))
        pedido.httpMethod = metodo
        if let token {
            // É esta linha que faz `requireAutor()` reconhecer o app do mesmo
            // jeito que reconhece o navegador (critério A.2).
            pedido.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let corpo {
            pedido.setValue("application/json", forHTTPHeaderField: "Content-Type")
            pedido.httpBody = try? JSONSerialization.data(
                withJSONObject: corpo.compactMapValues { $0 },
                options: []
            )
        }
        return pedido
    }

    @discardableResult
    func dados(_ pedido: URLRequest) async throws -> Data {
        let (dados, resposta): (Data, URLResponse)
        do {
            (dados, resposta) = try await sessao.data(for: pedido)
        } catch {
            throw ErroDaApi.semRede
        }

        guard let http = resposta as? HTTPURLResponse else { throw ErroDaApi.mensagem(Copy.erroGenerico) }
        guard (200..<300).contains(http.statusCode) else {
            throw erroDe(status: http.statusCode, corpo: dados)
        }
        return dados
    }

    func json<T: Decodable>(_ pedido: URLRequest, como tipo: T.Type = T.self) async throws -> T {
        let dados = try await dados(pedido)
        do {
            return try decodificador.decode(T.self, from: dados)
        } catch {
            throw ErroDaApi.mensagem(Copy.erroGenerico)
        }
    }

    // Traduz o código e o corpo da resposta no erro que a tela sabe tratar.
    // O 404 vale por "não é seu" também, e é assim de propósito: o servidor não
    // distingue livro inexistente de livro alheio (seção 6 do spec).
    private func erroDe(status: Int, corpo: Data) -> ErroDaApi {
        let lido = try? decodificador.decode(CorpoDeErro.self, from: corpo)
        let mensagem = lido?.erro ?? Copy.erroGenerico

        if status == 401 { return .naoAutenticado }
        if status == 409 {
            if lido?.destino == "/conta/handle" { return .precisaDeHandle }
            if lido?.sugestao != nil || lido?.campo != nil {
                return .emUso(mensagem: mensagem, sugestao: lido?.sugestao)
            }
            if mensagem.hasPrefix("Você chegou ao limite") { return .limiteAtingido(mensagem) }
        }
        return .mensagem(mensagem)
    }

    // -----------------------------------------------------------------------
    // Sessão e conta
    // -----------------------------------------------------------------------

    struct SessaoAberta: Decodable {
        let token: String
        let expiraEm: String
        let conta: ContaDoApp
    }

    func abrirSessao(idTokenDoGoogle: String) async throws -> SessaoAberta {
        try await json(requisicao("api/app/sessao", metodo: "POST", corpo: ["id_token": idTokenDoGoogle]))
    }

    private struct RespostaDaConta: Decodable { let conta: ContaDoApp }

    func conta() async throws -> ContaDoApp {
        try await json(requisicao("api/app/conta"), como: RespostaDaConta.self).conta
    }

    func excluirConta() async throws {
        try await dados(requisicao("api/conta", metodo: "DELETE"))
    }

    // -----------------------------------------------------------------------
    // Endereço público (handle)
    // -----------------------------------------------------------------------

    struct DisponibilidadeDeHandle: Decodable {
        let valido: Bool
        let disponivel: Bool
        let sugestao: String?
    }

    func handleDisponivel(_ handle: String) async throws -> DisponibilidadeDeHandle {
        var componentes = URLComponents(
            url: Configuracao.servidor.appendingPathComponent("api/conta/handle"),
            resolvingAgainstBaseURL: false
        )!
        componentes.queryItems = [URLQueryItem(name: "handle", value: handle)]
        var pedido = requisicao("api/conta/handle")
        pedido.url = componentes.url
        return try await json(pedido)
    }

    func definirHandle(_ handle: String) async throws {
        try await dados(requisicao("api/conta/handle", metodo: "POST", corpo: ["handle": handle]))
    }

    // -----------------------------------------------------------------------
    // Livros
    // -----------------------------------------------------------------------

    func livros() async throws -> ListaDeLivros {
        try await json(requisicao("api/conta/livros"))
    }

    private struct RespostaDoLivro: Decodable { let livro: LivroDoAutor }

    func livro(_ id: String) async throws -> LivroDoAutor {
        try await json(requisicao("api/conta/livros/\(id)"), como: RespostaDoLivro.self).livro
    }

    // O PDF já subiu pela sessão de upload; o corpo traz o caminho, não os bytes
    // (spec seção 13.2).
    func criarLivro(
        metadados: MetadadosDoLivro,
        livroId: String,
        tamanhoBytes: Int,
        totalPaginas: Int?,
        capaBase64: String?
    ) async throws -> LivroDoAutor {
        let pedido = requisicao("api/conta/livros", metodo: "POST", corpo: [
            "titulo": metadados.titulo,
            "subtitulo": metadados.subtitulo,
            "slug": metadados.slug,
            "autor": metadados.autor,
            "descricao": metadados.descricao,
            "livro_id": livroId,
            "arquivo_pdf_tamanho_bytes": tamanhoBytes,
            "total_paginas": totalPaginas,
            "capa_base64": capaBase64,
        ])
        return try await json(pedido, como: RespostaDoLivro.self).livro
    }

    func atualizarLivro(_ id: String, metadados: MetadadosDoLivro) async throws -> LivroDoAutor {
        let pedido = requisicao("api/conta/livros/\(id)", metodo: "PUT", corpo: [
            "titulo": metadados.titulo,
            "subtitulo": metadados.subtitulo,
            "slug": metadados.slug,
            "autor": metadados.autor,
            "descricao": metadados.descricao,
        ])
        return try await json(pedido, como: RespostaDoLivro.self).livro
    }

    func publicar(_ id: String, publicado: Bool) async throws -> LivroDoAutor {
        let caminho = "api/conta/livros/\(id)/\(publicado ? "publicar" : "despublicar")"
        return try await json(requisicao(caminho, metodo: "POST"), como: RespostaDoLivro.self).livro
    }

    func excluirLivro(_ id: String) async throws {
        try await dados(requisicao("api/conta/livros/\(id)", metodo: "DELETE"))
    }

    func substituirPdf(
        _ id: String,
        tamanhoBytes: Int,
        totalPaginas: Int?,
        capaBase64: String?
    ) async throws -> LivroDoAutor {
        let pedido = requisicao("api/conta/livros/\(id)/substituir-pdf", metodo: "POST", corpo: [
            "arquivo_pdf_tamanho_bytes": tamanhoBytes,
            "total_paginas": totalPaginas,
            "capa_base64": capaBase64,
        ])
        return try await json(pedido, como: RespostaDoLivro.self).livro
    }

    // -----------------------------------------------------------------------
    // Assinatura
    // -----------------------------------------------------------------------

    // Manda a prova da Apple e devolve a conta já com o plano que o servidor
    // decidiu (regra iOS 10.5). O app nunca escreve plano.
    func confirmarAssinatura(transacaoJws: String, renovacaoJws: String?) async throws -> ContaDoApp {
        let pedido = requisicao("api/app/assinatura", metodo: "POST", corpo: [
            "transacao_jws": transacaoJws,
            "renovacao_jws": renovacaoJws,
        ])
        return try await json(pedido, como: RespostaDaConta.self).conta
    }

    // -----------------------------------------------------------------------
    // Arquivos
    // -----------------------------------------------------------------------

    // Baixa o PDF para um arquivo temporário, com o token no cabeçalho.
    //
    // Com token, e não direto pela URL: a prévia de rascunho só responde para o
    // dono (critério C.6), e sem o cabeçalho o servidor devolveria 404 no próprio
    // livro de quem está pedindo.
    func baixarPdf(de url: URL) async throws -> URL {
        var pedido = URLRequest(url: url)
        if let token { pedido.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let (arquivo, resposta): (URL, URLResponse)
        do {
            (arquivo, resposta) = try await sessao.download(for: pedido)
        } catch {
            throw ErroDaApi.semRede
        }
        guard let http = resposta as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ErroDaApi.mensagem(Copy.erroGenerico)
        }

        // O arquivo que o `download` devolve é apagado ao fim da chamada.
        let destino = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).pdf")
        try? FileManager.default.removeItem(at: destino)
        try FileManager.default.moveItem(at: arquivo, to: destino)
        return destino
    }

    func imagem(de url: URL) async throws -> Data {
        var pedido = URLRequest(url: url)
        if let token { pedido.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return try await dados(pedido)
    }
}
