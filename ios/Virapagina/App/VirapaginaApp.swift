// O ponto de entrada do app (spec-ios seção 6).
import SwiftUI

@main
struct VirapaginaApp: App {
    @StateObject private var sessao = Sessao()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(sessao)
                // O único tom de destaque do produto, aplicado a tudo que o
                // sistema colore sozinho (spec seção 16).
                .tint(.destaque)
                // Sem modo escuro, exceto o leitor — igual à web.
                .preferredColorScheme(.light)
        }
    }
}
