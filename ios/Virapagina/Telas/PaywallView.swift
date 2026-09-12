// Paywall — spec-ios seção 6.9, épico D.
//
// Aparece quando a conta chega ao limite e tenta criar o próximo livro. Diz, sem
// eufemismo, que os livros já publicados continuam no ar mesmo sem assinatura
// (regra iOS 10.4): o limite nunca tirou nada do ar, e esconder isso para vender
// assinatura seria mentir sobre o produto.
//
// O preço vem da loja, nunca do código (regra iOS 10.6).
import StoreKit
import SwiftUI

struct PaywallView: View {
    @EnvironmentObject private var sessao: Sessao
    @Environment(\.dismiss) private var fechar
    @StateObject private var loja = Loja()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 10) {
                        Image(systemName: "books.vertical.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(Color.destaque)
                        Text(Copy.paywallTitulo)
                            .font(.system(.largeTitle, design: .serif))
                            .foregroundStyle(Color.tinta)
                        if let limite = sessao.conta?.uso.limite {
                            Text(Copy.limiteAtingido(limite))
                                .font(.subheadline)
                                .foregroundStyle(Color.tintaSuave)
                        }
                    }
                    .padding(.top, 16)

                    VStack(alignment: .leading, spacing: 14) {
                        linha(Copy.paywallLinha1)
                        linha(Copy.paywallLinha2)
                        linha(Copy.paywallLinha3)
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.superficie)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Text(Copy.paywallTranquilidade)
                        .font(.footnote)
                        .foregroundStyle(Color.tintaSuave)
                        .multilineTextAlignment(.center)

                    if let erro = loja.erro { Aviso(texto: erro) }

                    VStack(spacing: 10) {
                        BotaoPrimario(titulo: textoDoBotao, carregando: loja.trabalhando) {
                            Task { await assinar() }
                        }
                        Button(Copy.paywallRestaurar) { Task { await restaurar() } }
                            .font(.footnote)
                        LinksLegais()
                    }
                }
                .padding(20)
            }
            .background(Color.tela)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fechar") { fechar() }
                }
            }
            .task { await loja.carregar() }
        }
    }

    private var textoDoBotao: String {
        guard let produto = loja.produto else { return "Assinar" }
        return "Assinar por \(produto.displayPrice) por mês"
    }

    private func linha(_ texto: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checkmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(Color.destaque)
                .padding(.top, 3)
            Text(texto).font(.subheadline).foregroundStyle(Color.tinta)
        }
    }

    private func assinar() async {
        do {
            // A conta vem do servidor já com o plano decidido lá (regra iOS
            // 10.5). Se ela voltou, a compra valeu.
            if try await loja.assinar() != nil {
                await sessao.recarregarConta()
                fechar()
            }
        } catch {
            sessao.tratar(error)
            loja.erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }

    private func restaurar() async {
        do {
            if try await loja.restaurar() != nil {
                await sessao.recarregarConta()
                fechar()
            }
        } catch {
            sessao.tratar(error)
            loja.erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }
}
