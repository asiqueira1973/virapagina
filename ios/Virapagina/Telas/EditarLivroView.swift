// Editar informações — spec-ios seção 6.6.
//
// O mesmo formulário de criar, sem o arquivo. A única regra própria desta tela é
// o aviso ao trocar o endereço de um livro **já publicado**: o link muda, e quem
// tinha o antigo passa a receber página não encontrada (critério 8.2 do spec).
import SwiftUI

struct EditarLivroView: View {
    let livro: LivroDoAutor
    let aoSalvar: (LivroDoAutor) async -> Void

    @EnvironmentObject private var sessao: Sessao
    @Environment(\.dismiss) private var fechar

    @State private var metadados: MetadadosDoLivro
    @State private var salvando = false
    @State private var erro: String?
    @State private var erroDeSlug: String?
    @State private var sugestaoDeSlug: String?
    @State private var confirmandoTrocaDeSlug = false

    init(livro: LivroDoAutor, aoSalvar: @escaping (LivroDoAutor) async -> Void) {
        self.livro = livro
        self.aoSalvar = aoSalvar
        _metadados = State(initialValue: MetadadosDoLivro(de: livro))
    }

    var body: some View {
        NavigationStack {
            Form {
                CamposDoLivro(
                    metadados: $metadados,
                    handle: sessao.conta?.handle ?? "",
                    erroDeSlug: erroDeSlug,
                    sugestaoDeSlug: sugestaoDeSlug,
                    aoUsarSugestao: {
                        if let sugestaoDeSlug { metadados.slug = sugestaoDeSlug }
                        sugestaoDeSlug = nil
                        erroDeSlug = nil
                    }
                )
                if let erro { Section { Aviso(texto: erro) } }
            }
            .scrollContentBackground(.hidden)
            .background(Color.tela)
            .navigationTitle("Editar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { fechar() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") { tentarSalvar() }
                        .disabled(salvando || metadados.titulo.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .confirmationDialog(
                Copy.avisoTrocaDeSlug,
                isPresented: $confirmandoTrocaDeSlug,
                titleVisibility: .visible
            ) {
                Button("Continuar") { Task { await salvar() } }
                Button("Cancelar", role: .cancel) {}
            }
        }
    }

    private func tentarSalvar() {
        if livro.publicado && metadados.slug != livro.slug {
            confirmandoTrocaDeSlug = true
        } else {
            Task { await salvar() }
        }
    }

    private func salvar() async {
        salvando = true
        erro = nil
        erroDeSlug = nil
        sugestaoDeSlug = nil
        defer { salvando = false }
        do {
            let atualizado = try await Api.shared.atualizarLivro(livro.id, metadados: metadados)
            await aoSalvar(atualizado)
            fechar()
        } catch let ErroDaApi.emUso(mensagem, sugestao) {
            erroDeSlug = mensagem
            sugestaoDeSlug = sugestao
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }
}
