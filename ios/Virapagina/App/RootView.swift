// Quem decide qual tela o app mostra (spec-ios épico B).
//
// Três estados e nenhuma navegação entre eles: sem sessão é a tela de entrar,
// sem endereço é a tela de escolha — que ocupa tudo e não é pulável (critério
// B.2) —, e com os dois é o app.
import SwiftUI

struct RootView: View {
    @EnvironmentObject private var sessao: Sessao

    var body: some View {
        Group {
            switch sessao.estado {
            case .verificando:
                // Um instante só, enquanto o token do Keychain é conferido.
                // Sem isto, quem já está logado veria a tela de entrar piscar.
                ZStack {
                    Color.tela.ignoresSafeArea()
                    ProgressView()
                }
            case .fora:
                EntrarView()
            case .semEndereco:
                EscolherEnderecoView()
            case .dentro:
                AbasView()
            }
        }
        .task { await sessao.restaurar() }
    }
}

// As duas abas do app: o app tem exatamente dois assuntos, e menu lateral em
// iPhone é padrão de web disfarçado (spec-ios seção 6).
struct AbasView: View {
    var body: some View {
        TabView {
            LivrosView()
                .tabItem { Label("Livros", systemImage: "books.vertical") }
            ContaView()
                .tabItem { Label("Conta", systemImage: "person.crop.circle") }
        }
    }
}
