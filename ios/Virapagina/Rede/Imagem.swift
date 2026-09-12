// A capa de um livro, carregada com o token do app.
//
// `AsyncImage` do SwiftUI não serve aqui: ele não deixa acrescentar cabeçalho, e
// a capa de um **rascunho** só responde para o dono (critério C.6). Sem o
// bearer, a capa de todo livro não publicado apareceria vazia no painel de quem
// o criou.
import SwiftUI

struct AsyncImageAutenticada<Conteudo: View, Vazio: View>: View {
    let url: URL?
    @ViewBuilder let conteudo: (Image) -> Conteudo
    @ViewBuilder let vazio: () -> Vazio

    @State private var imagem: Image?
    @State private var carregada: URL?

    var body: some View {
        ZStack {
            if let imagem {
                conteudo(imagem)
            } else {
                vazio()
            }
        }
        .task(id: url) { await carregar() }
    }

    private func carregar() async {
        guard let url, url != carregada else { return }
        guard let dados = try? await Api.shared.imagem(de: url),
              let uiImage = UIImage(data: dados)
        else { return }
        imagem = Image(uiImage: uiImage)
        carregada = url
    }
}
