// O envio do PDF, em três etapas nomeadas (spec-ios seção 6.4, spec seção 9).
//
// O caminho é o mesmo da web, e por um motivo que não é estética: os bytes
// **não** passam pelo nosso servidor. Função serverless da Vercel aceita ~4,5 MB
// de corpo, o que tornaria a regra 11.2 (PDF de até 100 MB) impossível. A rota
// abre uma sessão de upload no Storage e devolve a URL temporária; o app manda os
// bytes direto para o Google, com progresso real; a credencial da conta de
// serviço nunca sai do servidor.
import Foundation

@MainActor
final class EnvioDePdf: NSObject, ObservableObject {
    enum Etapa: Equatable {
        case ocioso, lendo, enviando, salvando

        var descricao: String {
            switch self {
            case .ocioso: return ""
            case .lendo: return "Lendo o PDF e gerando a capa"
            case .enviando: return "Enviando o arquivo"
            case .salvando: return "Salvando o livro"
            }
        }
    }

    struct Resultado {
        let livroId: String
        let tamanhoBytes: Int
        let totalPaginas: Int?
        let capaBase64: String?
    }

    @Published private(set) var etapa: Etapa = .ocioso
    @Published private(set) var progresso: Double = 0

    private var tarefa: URLSessionUploadTask?

    // `livroExistente` só é passado ao substituir o PDF de um livro que já
    // existe: assim o arquivo novo cai na **mesma pasta** e sobrescreve o
    // antigo. Derivar a pasta do id do documento seria o defeito da pegadinha 10
    // do CLAUDE.md — nos livros antigos os dois ids divergem.
    func enviar(arquivo: URL, livroExistente: String? = nil) async throws -> Resultado {
        progresso = 0

        // 1. Lê no aparelho: total de páginas e capa da primeira página.
        etapa = .lendo
        let leitura = Pdf.ler(arquivo)

        // 2. Abre a sessão de upload pela nossa rota, que também confere o
        // limite do plano antes de deixar qualquer byte subir (regra 11.8).
        etapa = .enviando
        let sessao = try await abrirSessao(tamanho: leitura.tamanhoBytes, livroExistente: livroExistente)

        // 3. Manda os bytes direto para o Google.
        try await enviarBytes(arquivo: arquivo, para: sessao.uploadUrl)

        etapa = .salvando
        return Resultado(
            livroId: sessao.livroId,
            tamanhoBytes: leitura.tamanhoBytes,
            totalPaginas: leitura.totalPaginas,
            capaBase64: leitura.capaBase64
        )
    }

    func cancelar() {
        tarefa?.cancel()
        tarefa = nil
        etapa = .ocioso
        progresso = 0
    }

    // --- Passos ---

    private struct SessaoDeUpload: Decodable {
        let uploadUrl: String
        let livroId: String
    }

    private func abrirSessao(tamanho: Int, livroExistente: String?) async throws -> (uploadUrl: URL, livroId: String) {
        let pedido = Api.shared.requisicao("api/conta/livros/sessao-upload", metodo: "POST", corpo: [
            "mimeType": "application/pdf",
            "tamanhoBytes": tamanho,
            "livro_id": livroExistente,
        ])
        let resposta: SessaoDeUpload = try await Api.shared.json(pedido)
        guard let url = URL(string: resposta.uploadUrl) else { throw ErroDaApi.mensagem(Copy.erroDeUpload) }
        return (url, resposta.livroId)
    }

    private func enviarBytes(arquivo: URL, para url: URL) async throws {
        var pedido = URLRequest(url: url)
        pedido.httpMethod = "PUT"
        pedido.setValue("application/pdf", forHTTPHeaderField: "Content-Type")

        let sessao = URLSession(configuration: .default)
        do {
            let (_, resposta) = try await sessao.upload(for: pedido, fromFile: arquivo, delegate: self)
            guard let http = resposta as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw ErroDaApi.mensagem(Copy.erroDeUpload)
            }
        } catch let erro as ErroDaApi {
            throw erro
        } catch {
            // Conexão que cai no meio do envio cai aqui. O formulário mostra o
            // erro e **mantém os campos preenchidos** (fluxo de exceção da
            // seção 9).
            throw ErroDaApi.mensagem(Copy.erroDeUpload)
        }
    }
}

// O progresso real da barra. Chega numa fila do `URLSession`, então volta para a
// main antes de virar estado de tela.
extension EnvioDePdf: URLSessionTaskDelegate {
    nonisolated func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        guard totalBytesExpectedToSend > 0 else { return }
        let fracao = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
        Task { @MainActor in self.progresso = fracao }
    }
}
