// A paleta do produto, traduzida para o iOS (spec-ios seção 10).
//
// Os neutros e as cores semânticas são os mesmos de `app/globals.css`. O
// destaque **não é mais**: o site passou a usar o quase-preto como cor da ação
// e deixou o azul só para a marca (spec seção 16), e o app continuou no azul.
//
// A divergência é deliberada, não esquecimento: o Build 5 está em revisão na
// App Store, e trocar a cara do app no meio disso troca o que a Apple está
// olhando. Alinhar o app é decisão do Alexandre, não da próxima pessoa que
// abrir este arquivo.
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

    // O destaque do app. Na web este azul virou cor de marca e saiu dos botões;
    // aqui ele continua sendo a cor da ação até a decisão de alinhar.
    static let destaque = Color(0x1C5FD8)
    static let destaqueEscuro = Color(0x12439B)
    static let destaqueFraco = Color(0xEEF3FD)

    // Estados
    static let perigo = Color(0xA32020)
    static let perigoFundo = Color(0xFDF2F2)
    static let publicado = Color(0x1A7F4B)
    static let publicadoFundo = Color(0xEAF6EF)
}
