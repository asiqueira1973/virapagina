// Gera os PDFs de exemplo usados nos screenshots da App Store.
//
// Não faz parte do produto: é ferramenta de bastidor, e por isso vive fora do
// repositório. Cada livro sai com capa própria e páginas internas plausíveis —
// capa feia em screenshot de loja é o que faz o app parecer inacabado.
//
//   swift gerar.swift
import AppKit
import Foundation

let A4 = CGSize(width: 595, height: 842)

struct Livro {
    let arquivo: String
    let titulo: String
    let subtitulo: String
    let autor: String
    let fundo: NSColor
    let tinta: NSColor
    let destaque: NSColor
    let serifada: Bool
    let paginas: Int
    let secoes: [String]
    let texto: [String]
}

func cor(_ hex: UInt32) -> NSColor {
    NSColor(
        srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
        green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255,
        alpha: 1
    )
}

let corpo = [
    "Toda decisão de produto é uma aposta sobre o que as pessoas vão fazer, e quase nenhuma delas se parece com a planilha que a antecedeu. O que separa quem acerta de quem erra não é a qualidade da previsão: é o tamanho do passo entre uma medição e a seguinte.",
    "Havia uma regra na casa: ninguém falava do trabalho depois das sete. Era uma regra impossível, como todas as boas regras, e foi quebrada quase todo dia — mas o fato de existir mudava o tom do que se dizia às sete e cinco.",
    "A primeira versão de qualquer coisa existe para ser jogada fora. O erro não é fazer errado na primeira vez; é fazer a primeira vez tão cara que jogá-la fora deixe de ser possível.",
    "O que a fotografia faz com o inverno é estranho. A luz fica mais curta e mais horizontal, e por isso tudo ganha volume ao meio-dia — a hora em que, no resto do ano, tudo fica chapado.",
    "Um catálogo não é uma lista. A lista é ordenada pelo que é mais fácil de ordenar; o catálogo é ordenado pelo que a pessoa do outro lado está procurando, que quase nunca é a mesma coisa.",
]

let livros: [Livro] = [
    Livro(
        arquivo: "conceitos-de-tecnologia",
        titulo: "Conceitos de Tecnologia",
        subtitulo: "para quem decide sem escrever código",
        autor: "Alexandre Siqueira",
        fundo: cor(0xF3EFE7), tinta: cor(0x1A1A18), destaque: cor(0xB3502C),
        serifada: true, paginas: 12,
        secoes: ["A palavra que ninguém explica", "Nuvem, sem metáfora", "O que custa caro", "Quando dizer não"],
        texto: corpo
    ),
    Livro(
        arquivo: "luz-de-inverno",
        titulo: "Luz de Inverno",
        subtitulo: "fotografias, 2019–2026",
        autor: "Alexandre Siqueira",
        fundo: cor(0x13161C), tinta: cor(0xF2F2F0), destaque: cor(0xC9A227),
        serifada: true, paginas: 10,
        secoes: ["Manhã", "Meio-dia", "A volta", "Última luz"],
        texto: corpo
    ),
    Livro(
        arquivo: "rua-27",
        titulo: "Rua 27",
        subtitulo: "uma zine sobre andar a pé",
        autor: "Coletivo Quadra",
        fundo: cor(0x111111), tinta: cor(0xFFFFFF), destaque: cor(0xE8552A),
        serifada: false, paginas: 8,
        secoes: ["Sai da calçada", "Quem atravessa", "Meio-fio", "Volta pra casa"],
        texto: corpo
    ),
    Livro(
        arquivo: "relatorio-2026",
        titulo: "Relatório Anual",
        subtitulo: "resultados e caminhos de 2026",
        autor: "Dab Lab",
        fundo: cor(0xFFFFFF), tinta: cor(0x17181A), destaque: cor(0x1C5FD8),
        serifada: false, paginas: 14,
        secoes: ["O ano em uma página", "Receita", "Pessoas", "O que vem"],
        texto: corpo
    ),
    Livro(
        arquivo: "cerrado",
        titulo: "Cerrado",
        subtitulo: "o que floresce depois do fogo",
        autor: "Marina Alencar",
        fundo: cor(0x1E3B2C), tinta: cor(0xF4F1E8), destaque: cor(0xD98E2B),
        serifada: true, paginas: 11,
        secoes: ["Seca", "Fogo", "A primeira chuva", "Outubro"],
        texto: corpo
    ),
]

func fonte(_ tamanho: CGFloat, serifada: Bool, negrito: Bool = false) -> NSFont {
    if serifada {
        let nome = negrito ? "Times New Roman Bold" : "Times New Roman"
        return NSFont(name: nome, size: tamanho) ?? .systemFont(ofSize: tamanho)
    }
    return .systemFont(ofSize: tamanho, weight: negrito ? .bold : .regular)
}

func desenhar(_ texto: String, em caixa: CGRect, fonte f: NSFont, cor c: NSColor, alinhamento: NSTextAlignment = .left, entrelinha: CGFloat = 1.35) {
    let paragrafo = NSMutableParagraphStyle()
    paragrafo.alignment = alinhamento
    paragrafo.lineHeightMultiple = entrelinha
    paragrafo.hyphenationFactor = 1
    (texto as NSString).draw(in: caixa, withAttributes: [
        .font: f, .foregroundColor: c, .paragraphStyle: paragrafo,
    ])
}

let pasta = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)

for livro in livros {
    let destino = pasta.appendingPathComponent("\(livro.arquivo).pdf")
    var caixa = CGRect(origin: .zero, size: A4)
    guard let consumidor = CGDataConsumer(url: destino as CFURL),
          let pdf = CGContext(consumer: consumidor, mediaBox: &caixa, nil)
    else { continue }

    for numero in 1...livro.paginas {
        pdf.beginPDFPage(nil)
        let anterior = NSGraphicsContext.current
        NSGraphicsContext.current = NSGraphicsContext(cgContext: pdf, flipped: false)

        if numero == 1 {
            // A capa. É ela que aparece na lista do app e na vitrine, então é a
            // única página que precisa funcionar com 44 pontos de largura.
            livro.fundo.setFill()
            caixa.fill()

            livro.destaque.setFill()
            CGRect(x: 64, y: A4.height - 150, width: 90, height: 6).fill()

            desenhar(
                livro.titulo,
                em: CGRect(x: 60, y: 300, width: A4.width - 120, height: 320),
                fonte: fonte(livro.serifada ? 58 : 52, serifada: livro.serifada, negrito: !livro.serifada),
                cor: livro.tinta,
                entrelinha: 1.08
            )
            desenhar(
                livro.subtitulo,
                em: CGRect(x: 62, y: 236, width: A4.width - 140, height: 60),
                fonte: fonte(17, serifada: livro.serifada),
                cor: livro.tinta.withAlphaComponent(0.72)
            )
            desenhar(
                livro.autor.uppercased(),
                em: CGRect(x: 62, y: 96, width: A4.width - 120, height: 30),
                fonte: fonte(12, serifada: false, negrito: true),
                cor: livro.destaque
            )
        } else {
            NSColor.white.setFill()
            caixa.fill()

            let secao = livro.secoes[(numero - 2) % livro.secoes.count]
            let abreSecao = (numero - 2) % 3 == 0

            desenhar(
                livro.titulo.uppercased(),
                em: CGRect(x: 64, y: A4.height - 72, width: A4.width - 128, height: 20),
                fonte: fonte(9, serifada: false, negrito: true),
                cor: cor(0x9A9A9A)
            )

            var topo = A4.height - 150.0
            if abreSecao {
                desenhar(
                    secao,
                    em: CGRect(x: 64, y: topo - 40, width: A4.width - 128, height: 60),
                    fonte: fonte(30, serifada: livro.serifada, negrito: !livro.serifada),
                    cor: cor(0x17181A),
                    entrelinha: 1.1
                )
                livro.destaque.setFill()
                CGRect(x: 64, y: topo - 62, width: 54, height: 3).fill()
                topo -= 96
            }

            var y = topo
            for indice in 0..<3 {
                let paragrafo = livro.texto[(numero + indice) % livro.texto.count]
                desenhar(
                    paragrafo,
                    em: CGRect(x: 64, y: y - 150, width: A4.width - 128, height: 150),
                    fonte: fonte(12.5, serifada: livro.serifada),
                    cor: cor(0x2B2C30),
                    alinhamento: .justified
                )
                y -= 168
            }

            // Um bloco de imagem a cada três páginas, para o miolo não ser só texto.
            if numero % 3 == 0 {
                livro.destaque.withAlphaComponent(0.16).setFill()
                CGRect(x: 64, y: 110, width: A4.width - 128, height: 150).fill()
                livro.destaque.withAlphaComponent(0.5).setFill()
                CGRect(x: 64, y: 110, width: 4, height: 150).fill()
            }

            desenhar(
                "\(numero)",
                em: CGRect(x: 64, y: 52, width: A4.width - 128, height: 18),
                fonte: fonte(10, serifada: false),
                cor: cor(0x9A9A9A),
                alinhamento: numero % 2 == 0 ? .left : .right
            )
        }

        NSGraphicsContext.current = anterior
        pdf.endPDFPage()
    }
    pdf.closePDF()

    // A capa em PNG, do mesmo desenho: é o que o app geraria da primeira página
    // e o que o seed precisa subir junto.
    let escala: CGFloat = 800 / A4.width
    if let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(A4.width * escala), pixelsHigh: Int(A4.height * escala),
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) {
        let contexto = NSGraphicsContext(bitmapImageRep: bitmap)!
        let anterior = NSGraphicsContext.current
        NSGraphicsContext.current = contexto
        contexto.cgContext.scaleBy(x: escala, y: escala)

        livro.fundo.setFill()
        CGRect(origin: .zero, size: A4).fill()
        livro.destaque.setFill()
        CGRect(x: 64, y: A4.height - 150, width: 90, height: 6).fill()
        desenhar(livro.titulo, em: CGRect(x: 60, y: 300, width: A4.width - 120, height: 320),
                 fonte: fonte(livro.serifada ? 58 : 52, serifada: livro.serifada, negrito: !livro.serifada),
                 cor: livro.tinta, entrelinha: 1.08)
        desenhar(livro.subtitulo, em: CGRect(x: 62, y: 236, width: A4.width - 140, height: 60),
                 fonte: fonte(17, serifada: livro.serifada), cor: livro.tinta.withAlphaComponent(0.72))
        desenhar(livro.autor.uppercased(), em: CGRect(x: 62, y: 96, width: A4.width - 120, height: 30),
                 fonte: fonte(12, serifada: false, negrito: true), cor: livro.destaque)

        NSGraphicsContext.current = anterior
        if let png = bitmap.representation(using: .png, properties: [:]) {
            try? png.write(to: pasta.appendingPathComponent("\(livro.arquivo)-capa.png"))
        }
    }

    print("gerado \(livro.arquivo).pdf (\(livro.paginas) páginas) + capa")
}
