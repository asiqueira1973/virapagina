// Leitura do PDF no aparelho (spec-ios regra iOS 10.9).
//
// O total de páginas e a capa saem daqui, do PDFKit, como na web saem do PDF.js
// no navegador. **O servidor nunca converte PDF em imagem** (princípio 0.1 do
// spec): o arquivo enviado é a fonte única, e o que a pessoa lê é literalmente o
// que ela baixa.
//
// A capa é a primeira página (regra 11.1), nas mesmas medidas da web — 800px de
// largura, escala limitada a 2 — para que um livro criado no app e outro criado
// no site não tenham capas de tamanhos diferentes na mesma vitrine.
import Foundation
import PDFKit
import UIKit

enum Pdf {
    // Teto da regra 11.2. O servidor confere de novo (regra iOS 10.8): esta
    // checagem é a que dá a mensagem, não a que vale.
    static let tamanhoMaximoBytes = 100 * 1024 * 1024

    struct Leitura {
        let tamanhoBytes: Int
        let totalPaginas: Int?
        let capaBase64: String?
    }

    // Devolve a mensagem de erro, ou nil quando o arquivo serve.
    static func validar(_ url: URL) -> String? {
        guard url.pathExtension.lowercased() == "pdf" else { return Copy.uploadNaoPdf }
        let tamanho = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        if tamanho <= 0 { return Copy.uploadNaoPdf }
        if tamanho > tamanhoMaximoBytes { return Copy.uploadGrandeDemais }
        return nil
    }

    static func ler(_ url: URL) -> Leitura {
        let tamanho = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard let documento = PDFDocument(url: url) else {
            // Livro sem capa e sem contagem é estado previsto (seção 7): os dois
            // campos são anuláveis e não podem impedir o cadastro.
            return Leitura(tamanhoBytes: tamanho, totalPaginas: nil, capaBase64: nil)
        }
        return Leitura(
            tamanhoBytes: tamanho,
            totalPaginas: documento.pageCount,
            capaBase64: capaBase64(de: documento)
        )
    }

    private static func capaBase64(de documento: PDFDocument) -> String? {
        guard let pagina = documento.page(at: 0) else { return nil }
        let caixa = pagina.bounds(for: .mediaBox)
        guard caixa.width > 0, caixa.height > 0 else { return nil }

        let escala = min(800 / caixa.width, 2)
        let tamanho = CGSize(width: caixa.width * escala, height: caixa.height * escala)
        let imagem = pagina.thumbnail(of: tamanho, for: .mediaBox)
        // A rota aceita com ou sem o prefixo `data:`; mandar sem economiza bytes
        // num corpo que já carrega uma imagem inteira.
        return imagem.pngData()?.base64EncodedString()
    }
}
