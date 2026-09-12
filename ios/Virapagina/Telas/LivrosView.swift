// Livros — spec-ios seção 6.3, épico C.
//
// A lista é a casa do app. O `+` faz uma coisa só, e o que ele abre depende do
// plano: com vaga, o formulário; sem vaga, o paywall (critério D.1). Botão
// desabilitado com aviso ao lado, como na web, seria a tradução errada — no
// iPhone o certo é o toque levar a algum lugar.
import SwiftUI

struct LivrosView: View {
    @EnvironmentObject private var sessao: Sessao

    @State private var livros: [LivroDoAutor] = []
    @State private var uso: ContaDoApp.Uso?
    @State private var carregando = true
    @State private var erro: String?
    @State private var mostrandoNovo = false
    @State private var mostrandoPaywall = false

    var body: some View {
        NavigationStack {
            Group {
                if carregando && livros.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let erro, livros.isEmpty {
                    EstadoVazio(
                        icone: "wifi.exclamationmark",
                        titulo: erro,
                        acao: (titulo: "Tentar de novo", executar: { Task { await carregar() } })
                    )
                } else if livros.isEmpty {
                    EstadoVazio(
                        icone: "book.closed",
                        titulo: Copy.listaVazia,
                        descricao: "Suba um PDF e ele vira um livro com link público.",
                        acao: (titulo: "Novo livro", executar: novoLivro)
                    )
                } else {
                    lista
                }
            }
            .background(Color.tela)
            .navigationTitle("Livros")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: novoLivro) { Image(systemName: "plus") }
                        .accessibilityLabel("Novo livro")
                }
            }
            .refreshable { await carregar() }
            .task { await carregar() }
            .sheet(isPresented: $mostrandoNovo) {
                NovoLivroView { await carregar() }
            }
            .sheet(isPresented: $mostrandoPaywall) {
                PaywallView()
            }
        }
    }

    private var lista: some View {
        List {
            Section {
                ForEach(livros) { livro in
                    NavigationLink(value: livro.id) {
                        LinhaDoLivro(livro: livro)
                    }
                }
            } header: {
                if let uso {
                    // "3 de 5 livros" — ou só a contagem, quando não há limite.
                    Text(uso.limite.map { "\(uso.livros) de \($0) livros" } ?? "\(uso.livros) livros")
                        .font(.footnote)
                        .foregroundStyle(Color.tintaSuave)
                        .textCase(nil)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.tela)
        .navigationDestination(for: String.self) { id in
            LivroView(livroId: id) { await carregar() }
        }
    }

    private func novoLivro() {
        // A resposta que vale é do servidor (regra 11.8); esta só evita abrir um
        // formulário que terminaria em 409 depois do upload inteiro.
        if sessao.conta?.podeCriarLivro == false {
            mostrandoPaywall = true
        } else {
            mostrandoNovo = true
        }
    }

    private func carregar() async {
        erro = nil
        do {
            let resposta = try await Api.shared.livros()
            livros = resposta.livros
            uso = resposta.uso
            // O plano pode ter mudado noutro aparelho — ou por notificação da
            // Apple, com o app fechado (critério D.4).
            await sessao.recarregarConta()
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
        carregando = false
    }
}

struct LinhaDoLivro: View {
    let livro: LivroDoAutor

    var body: some View {
        HStack(spacing: 12) {
            Capa(url: livro.urlDaCapa)

            VStack(alignment: .leading, spacing: 4) {
                Text(livro.titulo)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.tinta)
                    .lineLimit(2)

                Text(caminhoPublico)
                    .font(.caption)
                    .foregroundStyle(Color.tintaFraca)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    SeloDeEstado(publicado: livro.publicado)
                    if livro.removidoPorDenuncia {
                        Text("Despublicado pelo suporte")
                            .font(.caption2)
                            .foregroundStyle(Color.perigo)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var caminhoPublico: String {
        guard let url = livro.urlPublica else { return livro.slug }
        return "\(url.host ?? "")\(url.path)"
    }
}
