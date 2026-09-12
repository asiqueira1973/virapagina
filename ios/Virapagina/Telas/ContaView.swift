// Conta — spec-ios seção 6.8.
//
// Reúne o que é da pessoa e não do livro: o endereço público, o plano, a
// assinatura e as duas saídas — sair e excluir a conta.
//
// Excluir a conta dentro do app é exigência da App Review (spec-ios seção 12), e
// por isso a tela não a esconde num submenu. A confirmação pede o endereço
// digitado: é a que combina com uma ação que apaga arquivo de verdade.
import StoreKit
import SwiftUI

struct ContaView: View {
    @EnvironmentObject private var sessao: Sessao
    @StateObject private var loja = Loja()

    @State private var mostrandoPaywall = false
    @State private var gerenciandoAssinatura = false
    @State private var confirmandoExclusao = false
    @State private var confirmacaoDigitada = ""
    @State private var erro: String?
    @State private var copiado = false

    private var conta: ContaDoApp? { sessao.conta }

    var body: some View {
        NavigationStack {
            List {
                if let conta {
                    Section("Você") {
                        LinhaDeDetalhe("E-mail", valor: conta.email)
                        if let handle = conta.handle {
                            Button {
                                UIPasteboard.general.string =
                                    Configuracao.servidor.appendingPathComponent(handle).absoluteString
                                copiado = true
                            } label: {
                                HStack {
                                    Text("Endereço").foregroundStyle(Color.tintaSuave)
                                    Spacer()
                                    Text("\(Configuracao.servidor.host ?? "")/\(handle)")
                                        .foregroundStyle(Color.tinta)
                                    Image(systemName: copiado ? "checkmark" : "doc.on.doc")
                                        .font(.caption)
                                        .foregroundStyle(Color.destaque)
                                }
                                .font(.subheadline)
                            }
                        }
                    }

                    Section("Plano") {
                        LinhaDeDetalhe("Atual", valor: conta.rotuloDoPlano)
                        LinhaDeDetalhe(
                            "Livros",
                            valor: conta.uso.limite.map { "\(conta.uso.livros) de \($0)" }
                                ?? "\(conta.uso.livros), sem limite"
                        )

                        if conta.temAssinaturaValida {
                            if let expira = conta.assinatura?.expiraEm {
                                LinhaDeDetalhe("Renova em", valor: dataLegivel(expira))
                            }
                            Button("Gerenciar assinatura") { gerenciandoAssinatura = true }
                        } else if conta.uso.limite != nil {
                            // Só oferece assinar a quem tem limite: early adopter
                            // e conta da plataforma já são ilimitados, e vender
                            // a eles o que já têm seria desonesto (regra iOS 10.2).
                            Button("Assinar livros ilimitados") { mostrandoPaywall = true }
                            Button(Copy.paywallRestaurar) { Task { await restaurar() } }
                                .font(.subheadline)
                        }
                    }
                }

                if let erro { Section { Aviso(texto: erro) } }

                Section {
                    Link("Falar com a gente", destination: URL(string: "mailto:alexandre@dablab.com.br")!)
                    Link("Termos", destination: Configuracao.servidor.appendingPathComponent("termos"))
                    Link("Privacidade", destination: Configuracao.servidor.appendingPathComponent("privacidade"))
                }

                Section {
                    Button("Sair") { sessao.sair() }
                    Button(Copy.contaExcluirTitulo, role: .destructive) {
                        confirmacaoDigitada = ""
                        confirmandoExclusao = true
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.tela)
            .navigationTitle("Conta")
            .sheet(isPresented: $mostrandoPaywall) { PaywallView() }
            .manageSubscriptionsSheet(isPresented: $gerenciandoAssinatura)
            .alert(Copy.contaExcluirTitulo, isPresented: $confirmandoExclusao) {
                TextField(conta?.handle ?? "endereço", text: $confirmacaoDigitada)
                    .textInputAutocapitalization(.never)
                Button("Cancelar", role: .cancel) {}
                Button("Excluir", role: .destructive) { Task { await excluirConta() } }
                    .disabled(confirmacaoDigitada != conta?.handle)
            } message: {
                Text("\(Copy.contaExcluirAviso)\n\n\(Copy.contaExcluirConfirmacao)")
            }
            .task {
                await loja.carregar()
                // Renovação e cancelamento que aconteçam com o app aberto
                // chegam por aqui (critério D.4).
                loja.vigiarAtualizacoes { _ in
                    Task { await sessao.recarregarConta() }
                }
            }
            .refreshable { await sessao.recarregarConta() }
        }
    }

    private func restaurar() async {
        erro = nil
        do {
            if try await loja.restaurar() != nil {
                await sessao.recarregarConta()
            } else {
                erro = loja.erro
            }
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }

    private func excluirConta() async {
        // A confirmação já foi dada digitando o endereço; daqui em diante não há
        // volta, e é o servidor que apaga livros, arquivos, handle e conta,
        // nessa ordem (regra 11.6).
        guard confirmacaoDigitada == conta?.handle else { return }
        do {
            try await Api.shared.excluirConta()
            sessao.sair()
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }
}
