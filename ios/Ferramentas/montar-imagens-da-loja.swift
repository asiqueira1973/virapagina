// Monta as imagens da App Store: frase de marketing em cima, a tela do app
// embaixo, em 1242 x 2688 (6,5 polegadas).
//
// A frase fica na imagem, não na ficha — é o que a pessoa lê enquanto desliza a
// galeria da loja, e quase ninguém abre a descrição.
import AppKit
import Foundation

let L = CGSize(width: 1242, height: 2688)

func cor(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

struct Imagem {
    let arquivo: String
    let saida: String
    let frase: String
    let fundoTopo: NSColor
    let fundoBase: NSColor
    let tinta: NSColor
}

let claro = (topo: cor(0xFFFFFF), base: cor(0xEDEEF0))
let azul = (topo: cor(0x1C5FD8), base: cor(0x12439B))
let escuro = (topo: cor(0x1B1F27), base: cor(0x0E1116))

let imagens: [Imagem] = [
    .init(arquivo: "1-lista.png", saida: "loja-1-livros.png",
          frase: "Seus livros, cada um\ncom o seu link",
          fundoTopo: claro.topo, fundoBase: claro.base, tinta: cor(0x17181A)),
    .init(arquivo: "2-novo-livro.png", saida: "loja-2-novo.png",
          frase: "Escolha o PDF.\nO resto é automático",
          fundoTopo: claro.topo, fundoBase: claro.base, tinta: cor(0x17181A)),
    .init(arquivo: "3-livro.png", saida: "loja-3-publicar.png",
          frase: "Publicar e compartilhar\né um toque",
          fundoTopo: azul.topo, fundoBase: azul.base, tinta: .white),
    .init(arquivo: "4-leitor.png", saida: "loja-4-leitor.png",
          frase: "Quem recebe folheia\nno navegador, sem app",
          fundoTopo: escuro.topo, fundoBase: escuro.base, tinta: .white),
    .init(arquivo: "5-paywall.png", saida: "loja-5-assinatura.png",
          frase: "Cinco livros de graça.\nDepois, ilimitado",
          fundoTopo: claro.topo, fundoBase: claro.base, tinta: cor(0x17181A)),
]

func fonteSerifada(_ tamanho: CGFloat) -> NSFont {
    let base = NSFont.systemFont(ofSize: tamanho, weight: .medium)
    if let descritor = base.fontDescriptor.withDesign(.serif),
       let serifada = NSFont(descriptor: descritor, size: tamanho) {
        return serifada
    }
    return base
}

let entrada = URL(fileURLWithPath: CommandLine.arguments[1])
let saida = URL(fileURLWithPath: CommandLine.arguments[2])

for imagem in imagens {
    guard let tela = NSImage(contentsOf: entrada.appendingPathComponent(imagem.arquivo)),
          let telaCG = tela.cgImage(forProposedRect: nil, context: nil, hints: nil)
    else {
        print("faltou \(imagem.arquivo)")
        continue
    }

    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: Int(L.width), pixelsHigh: Int(L.height),
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) else { continue }

    let contexto = NSGraphicsContext(bitmapImageRep: bitmap)!
    let anterior = NSGraphicsContext.current
    NSGraphicsContext.current = contexto
    let ctx = contexto.cgContext

    // Fundo com um degradê curto — chapado demais fica sem profundidade, e
    // colorido demais rouba a atenção da tela do app, que é o assunto.
    let espaco = CGColorSpaceCreateDeviceRGB()
    let degrade = CGGradient(colorsSpace: espaco,
                             colors: [imagem.fundoTopo.cgColor, imagem.fundoBase.cgColor] as CFArray,
                             locations: [0, 1])!
    ctx.drawLinearGradient(degrade, start: CGPoint(x: 0, y: L.height), end: CGPoint(x: 0, y: 0), options: [])

    // A frase. Duas linhas, centralizada, em serifada — a mesma família dos
    // títulos grandes do site.
    let paragrafo = NSMutableParagraphStyle()
    paragrafo.alignment = .center
    paragrafo.lineHeightMultiple = 1.12
    let atributos: [NSAttributedString.Key: Any] = [
        .font: fonteSerifada(92),
        .foregroundColor: imagem.tinta,
        .paragraphStyle: paragrafo,
        .kern: -1.0,
    ]
    (imagem.frase as NSString).draw(
        in: CGRect(x: 80, y: L.height - 400, width: L.width - 160, height: 260),
        withAttributes: atributos
    )

    // A tela, com canto arredondado e uma sombra curta.
    let largura: CGFloat = 940
    let altura = largura * L.height / L.width
    let x = (L.width - largura) / 2
    let y = L.height - 500 - altura
    let moldura = CGRect(x: x, y: y, width: largura, height: altura)
    let caminho = CGPath(roundedRect: moldura, cornerWidth: 88, cornerHeight: 88, transform: nil)

    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -18), blur: 60,
                  color: CGColor(gray: 0, alpha: 0.28))
    ctx.addPath(caminho)
    ctx.setFillColor(CGColor(gray: 1, alpha: 1))
    ctx.fillPath()
    ctx.restoreGState()

    ctx.saveGState()
    ctx.addPath(caminho)
    ctx.clip()
    ctx.draw(telaCG, in: moldura)
    ctx.restoreGState()

    NSGraphicsContext.current = anterior

    if let png = bitmap.representation(using: .png, properties: [:]) {
        try? png.write(to: saida.appendingPathComponent(imagem.saida))
        print("montado \(imagem.saida)")
    }
}
