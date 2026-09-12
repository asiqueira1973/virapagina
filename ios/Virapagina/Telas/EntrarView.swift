// Entrar — spec-ios seção 6.1, critério B.1.
//
// Um botão só. Os links legais ficam visíveis aqui por exigência da App Review:
// app que cria conta precisa mostrar termos e privacidade antes do cadastro.
import SwiftUI

struct EntrarView: View {
    @EnvironmentObject private var sessao: Sessao

    var body: some View {
        ZStack {
            Color.tela.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 14) {
                    Image("IconeDaMarca")
                        .resizable()
                        .frame(width: 72, height: 72)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Text("Virapágina")
                        .font(.system(.largeTitle, design: .serif))
                        .foregroundStyle(Color.tinta)

                    Text(Copy.entrarFrase)
                        .font(.body)
                        .foregroundStyle(Color.tintaSuave)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }

                Spacer()

                VStack(spacing: 12) {
                    if let erro = sessao.erro {
                        Aviso(texto: erro)
                    }

                    BotaoPrimario(titulo: Copy.entrarBotao, carregando: sessao.entrando) {
                        Task { await sessao.entrar() }
                    }

                    Text(Copy.entrarRodape)
                        .font(.footnote)
                        .foregroundStyle(Color.tintaFraca)
                        .multilineTextAlignment(.center)

                    LinksLegais()
                        .padding(.top, 8)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 28)
            }
        }
    }
}

// Termos e privacidade, no navegador do sistema. Aparecem na tela de entrar, na
// conta e no paywall (spec-ios seção 12).
struct LinksLegais: View {
    var body: some View {
        HStack(spacing: 16) {
            Link("Termos", destination: Configuracao.servidor.appendingPathComponent("termos"))
            Text("·").foregroundStyle(Color.hairline)
            Link("Privacidade", destination: Configuracao.servidor.appendingPathComponent("privacidade"))
        }
        .font(.footnote)
        .foregroundStyle(Color.tintaFraca)
    }
}
