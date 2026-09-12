// Gera os ícones do Virapágina a partir de um desenho só (spec seção 16).
//
// Rodar à mão, quando o desenho mudar:
//
//     swift scripts/gerar-icones.swift
//
// Por que Swift num projeto Next: a máquina não tem rasterizador de SVG
// (rsvg, ImageMagick, Inkscape, cairosvg — nenhum), e acrescentar um só para
// isto seria uma dependência de build para um arquivo que muda uma vez por ano.
// O CoreGraphics já está no macOS e desenha exatamente o que o SVG de
// `app/icon.svg` descreve — os dois são a mesma marca, escrita duas vezes de
// propósito: um para o navegador, outro para os PNGs.
//
// A marca: uma página branca com a ponta virada, sobre o azul da plataforma,
// com uma segunda página espiando atrás. Nada além disso — no tamanho de um
// favicon, qualquer detalhe a mais vira sujeira.
import AppKit
import CoreGraphics
import Foundation

let azul = CGColor(red: 0x1C / 255, green: 0x5F / 255, blue: 0xD8 / 255, alpha: 1)
let azulEscuro = CGColor(red: 0x12 / 255, green: 0x43 / 255, blue: 0x9B / 255, alpha: 1)
let azulFraco = CGColor(red: 0xEE / 255, green: 0xF3 / 255, blue: 0xFD / 255, alpha: 1)
let branco = CGColor(gray: 1, alpha: 1)
let dobraClara = CGColor(red: 0xF5 / 255, green: 0xF5 / 255, blue: 0xF6 / 255, alpha: 1)
let dobraEscura = CGColor(red: 0xC3 / 255, green: 0xC5 / 255, blue: 0xCB / 255, alpha: 1)

// Todas as medidas são em cima de uma tela de 1024 e escalam junto.
let L: CGFloat = 1024

func desenhar(em ctx: CGContext, lado: CGFloat, cantoArredondado: Bool) {
    let e = lado / L
    ctx.saveGState()

    // O fundo. No iOS o ícone é quadrado e o sistema arredonda; no navegador
    // ninguém arredonda por nós, então o arquivo do site já vem arredondado.
    let quadrado = CGRect(x: 0, y: 0, width: lado, height: lado)
    let fundo = cantoArredondado
        ? CGPath(roundedRect: quadrado, cornerWidth: 224 * e, cornerHeight: 224 * e, transform: nil)
        : CGPath(rect: quadrado, transform: nil)
    ctx.addPath(fundo)
    ctx.clip()

    let espaco = CGColorSpaceCreateDeviceRGB()
    let gradiente = CGGradient(colorsSpace: espaco, colors: [azul, azulEscuro] as CFArray, locations: [0, 1])!
    ctx.drawLinearGradient(
        gradiente,
        start: CGPoint(x: 0, y: lado),
        end: CGPoint(x: lado, y: 0),
        options: []
    )

    // A página de trás, inclinada: é ela que faz a marca falar de folhear em vez
    // de falar de documento. Fica inteira dentro da tela, e paralela o bastante
    // para ser lida como "outra folha" e não como falha de alinhamento.
    ctx.saveGState()
    ctx.translateBy(x: 512 * e, y: 512 * e)
    ctx.rotate(by: 9 * .pi / 180)
    ctx.translateBy(x: -512 * e, y: -512 * e)
    let atras = CGRect(x: 318 * e, y: 240 * e, width: 384 * e, height: 548 * e)
    ctx.addPath(CGPath(roundedRect: atras, cornerWidth: 26 * e, cornerHeight: 26 * e, transform: nil))
    ctx.setFillColor(azulFraco.copy(alpha: 0.62)!)
    ctx.fillPath()
    ctx.restoreGState()

    // A página da frente, com a ponta de baixo virada. O corte e a aba são a
    // mesma diagonal, uma tirada e a outra dobrada por cima.
    let x0 = 320 * e, x1 = 704 * e
    let y0 = 232 * e, y1 = 792 * e   // coordenadas de desenho: y cresce para cima
    let dobra = 188 * e
    let raio = 26 * e

    // Em CoreGraphics a origem é embaixo, então "topo" é o y maior.
    let topo = lado - y0
    let base = lado - y1

    let pagina = CGMutablePath()
    pagina.move(to: CGPoint(x: x0 + raio, y: topo))
    pagina.addLine(to: CGPoint(x: x1 - raio, y: topo))
    pagina.addQuadCurve(to: CGPoint(x: x1, y: topo - raio), control: CGPoint(x: x1, y: topo))
    pagina.addLine(to: CGPoint(x: x1, y: base + dobra))
    pagina.addLine(to: CGPoint(x: x1 - dobra, y: base))
    pagina.addLine(to: CGPoint(x: x0 + raio, y: base))
    pagina.addQuadCurve(to: CGPoint(x: x0, y: base + raio), control: CGPoint(x: x0, y: base))
    pagina.addLine(to: CGPoint(x: x0, y: topo - raio))
    pagina.addQuadCurve(to: CGPoint(x: x0 + raio, y: topo), control: CGPoint(x: x0, y: topo))
    pagina.closeSubpath()

    // Uma sombra curta separa o papel do azul sem virar efeito.
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -10 * e), blur: 28 * e,
                  color: CGColor(gray: 0, alpha: 0.22))
    ctx.addPath(pagina)
    ctx.setFillColor(branco)
    ctx.fillPath()
    ctx.restoreGState()

    // A aba dobrada, com a leve sombra que a faz parecer papel e não recorte.
    // A aba é a mesma diagonal do corte, dobrada por cima da página: os dois
    // catetos encostam no corte e a hipotenusa, levemente curva, é a lombada da
    // dobra.
    let aba = CGMutablePath()
    aba.move(to: CGPoint(x: x1, y: base + dobra))
    aba.addLine(to: CGPoint(x: x1 - dobra, y: base))
    aba.addQuadCurve(
        to: CGPoint(x: x1, y: base + dobra),
        control: CGPoint(x: x1 - dobra * 0.34, y: base + dobra * 0.34)
    )
    aba.closeSubpath()

    ctx.saveGState()
    ctx.addPath(aba)
    ctx.clip()
    let sombra = CGGradient(colorsSpace: espaco, colors: [dobraEscura, dobraClara] as CFArray, locations: [0, 1])!
    ctx.drawLinearGradient(
        sombra,
        start: CGPoint(x: x1 - dobra * 0.9, y: base + dobra * 0.9),
        end: CGPoint(x: x1 - dobra * 0.1, y: base + dobra * 0.1),
        options: []
    )
    ctx.restoreGState()

    ctx.restoreGState()
}

func png(lado: Int, cantoArredondado: Bool) -> Data {
    let ctx = CGContext(
        data: nil,
        width: lado,
        height: lado,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    ctx.setAllowsAntialiasing(true)
    ctx.interpolationQuality = .high
    desenhar(em: ctx, lado: CGFloat(lado), cantoArredondado: cantoArredondado)
    let imagem = ctx.makeImage()!
    let rep = NSBitmapImageRep(cgImage: imagem)
    return rep.representation(using: .png, properties: [:])!
}

// Um .ico com um PNG dentro — formato aceito desde o Vista. Existe para os
// navegadores que ainda pedem `/favicon.ico` antes de olhar o SVG.
func ico(de imagem: Data, lado: Int) -> Data {
    var arquivo = Data()
    arquivo.append(contentsOf: [0, 0, 1, 0, 1, 0]) // reservado, tipo ícone, uma imagem
    let medida = UInt8(lado == 256 ? 0 : lado)
    arquivo.append(contentsOf: [medida, medida, 0, 0, 1, 0, 32, 0])
    var tamanho = UInt32(imagem.count).littleEndian
    withUnsafeBytes(of: &tamanho) { arquivo.append(contentsOf: $0) }
    // O PNG começa logo depois do cabeçalho de 6 bytes e da entrada de 16.
    var deslocamento = UInt32(22).littleEndian
    withUnsafeBytes(of: &deslocamento) { arquivo.append(contentsOf: $0) }
    arquivo.append(imagem)
    return arquivo
}

let raiz = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)

func escrever(_ dados: Data, em caminho: String) {
    let destino = raiz.appendingPathComponent(caminho)
    try? FileManager.default.createDirectory(
        at: destino.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    try! dados.write(to: destino)
    print("gerado \(caminho)")
}

// O 1024 quadrado é o ícone do app — o iOS arredonda sozinho, e um PNG já
// arredondado ganharia cantos duas vezes.
escrever(png(lado: 1024, cantoArredondado: false),
         em: "ios/Virapagina/Assets.xcassets/AppIcon.appiconset/icone-1024.png")

// O 180 é o atalho na tela de início pelo Safari, e também a marca que a tela de
// entrar do app mostra.
let icone180 = png(lado: 180, cantoArredondado: true)
escrever(icone180, em: "app/apple-icon.png")
escrever(icone180, em: "ios/Virapagina/Assets.xcassets/IconeDaMarca.imageset/icone-180.png")

// O favicon dos navegadores antigos. Os modernos pegam o `app/icon.svg`, que é
// a mesma marca escrita em SVG.
escrever(ico(de: png(lado: 64, cantoArredondado: true), lado: 64), em: "app/favicon.ico")
