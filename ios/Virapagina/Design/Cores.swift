// A paleta do produto, traduzida para o iOS (spec-ios seção 10).
//
// São os mesmos valores de `app/globals.css` — um tom de destaque só, o resto
// neutro, e cor semântica separada da cor de marca. Azul nunca é status.
//
// Sem modo escuro, exceto o leitor, que é sempre escuro: igual à web. Por isso
// as cores são literais e não `Color(.systemBackground)` — um app que muda de
// cara conforme o sistema não seria o mesmo produto que o site.
import SwiftUI

extension Color {
    init(_ hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }

    // Superfícies
    static let tela = Color(0xF5F5F6)
    static let superficie = Color(0xFFFFFF)

    // Texto, do mais forte ao mais apagado
    static let tinta = Color(0x17181A)
    static let tintaMedia = Color(0x42444A)
    static let tintaSuave = Color(0x5C5E64)
    static let tintaFraca = Color(0x75777C)

    // Hairlines e preenchimentos
    static let hairline = Color(0xE4E4E6)
    static let preenchimento = Color(0xEFEFF1)

    // O único tom de destaque
    static let destaque = Color(0x1C5FD8)
    static let destaqueEscuro = Color(0x12439B)
    static let destaqueFraco = Color(0xEEF3FD)

    // Estados
    static let perigo = Color(0xA32020)
    static let perigoFundo = Color(0xFDF2F2)
    static let publicado = Color(0x1A7F4B)
    static let publicadoFundo = Color(0xEAF6EF)
}
