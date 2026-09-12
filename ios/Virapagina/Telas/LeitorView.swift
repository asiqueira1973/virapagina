// Leitor — spec-ios seção 6.7, critério C.6.
//
// Fundo escuro ocupando a tela inteira, barra flutuante embaixo com "12 de 44" e
// o compartilhar. Em rascunho, o cabeçalho ganha " · prévia de rascunho", como
// na web.
//
// O PDF é baixado pela mesma rota de proxy do site, **com o token no cabeçalho**:
// rascunho só responde para o dono. E a URL já vem com `?v=` do servidor (regra
// iOS 10.10) — sem isso, o autor trocaria o arquivo e continuaria lendo o antigo,
// entregue pelo cache.
import SwiftUI

struct LeitorView: View {
    let livro: LivroDoAutor

    @Environment(\.dismiss) private var fechar
    @State private var arquivo: URL?
    @State private var erro: String?
    @State private var pagina = 1
    @State private var totalDePaginas = 0

    var body: some View {
        ZStack {
            Color(white: 0.07).ignoresSafeArea()

            if let arquivo {
                LeitorPdf(arquivo: arquivo, paginaAtual: $pagina, totalDePaginas: $totalDePaginas)
                    .ignoresSafeArea(edges: .bottom)
            } else if let erro {
                EstadoVazio(icone: "exclamationmark.triangle", titulo: erro)
                    .foregroundStyle(.white)
            } else {
                // Nunca uma tela em branco enquanto o arquivo desce.
                ProgressView().tint(.white)
            }

            VStack {
                cabecalho
                Spacer()
                if arquivo != nil { barra }
            }
        }
        .statusBarHidden()
        .task { await baixar() }
    }

    private var cabecalho: some View {
        HStack(alignment: .top, spacing: 12) {
            Button { fechar() } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(10)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .accessibilityLabel("Voltar")

            VStack(alignment: .leading, spacing: 2) {
                Text(livro.titulo)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(livro.publicado ? livro.autor : "\(livro.autor) · \(Copy.previaDeRascunho)")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private var barra: some View {
        HStack(spacing: 14) {
            Text(totalDePaginas > 0 ? "\(pagina) de \(totalDePaginas)" : "—")
                .font(.footnote.weight(.medium))
                .foregroundStyle(.white)
                .monospacedDigit()

            if let url = livro.urlPublica {
                Divider().frame(height: 16).overlay(.white.opacity(0.25))
                ShareLink(item: url) {
                    Image(systemName: "square.and.arrow.up").foregroundStyle(.white)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(.bottom, 24)
    }

    private func baixar() async {
        guard let url = livro.urlDoPdf else {
            erro = Copy.erroGenerico
            return
        }
        do {
            arquivo = try await Api.shared.baixarPdf(de: url)
        } catch {
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }
}
