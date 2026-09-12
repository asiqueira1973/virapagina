// Livro — spec-ios seção 6.5, critérios C.4, C.5 e C.6.
//
// A tela que reúne o que a web espalha em duas colunas: estado, ações, arquivo e
// exclusão. A ordem segue o que se faz com mais frequência — publicar, ver,
// compartilhar — e termina no que não se desfaz.
import SwiftUI

struct LivroView: View {
    let livroId: String
    let aoMudar: () async -> Void

    @EnvironmentObject private var sessao: Sessao
    @Environment(\.dismiss) private var fechar

    @State private var livro: LivroDoAutor?
    @State private var carregando = true
    @State private var trabalhando = false
    @State private var erro: String?
    @State private var confirmandoExclusao = false
    @State private var editando = false
    @State private var lendo = false
    @State private var substituindo = false
    @StateObject private var envio = EnvioDePdf()

    var body: some View {
        Group {
            if let livro {
                conteudo(livro)
            } else if carregando {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                EstadoVazio(icone: "exclamationmark.triangle", titulo: erro ?? Copy.erroGenerico)
            }
        }
        .background(Color.tela)
        .navigationBarTitleDisplayMode(.inline)
        .task { await carregar() }
    }

    private func conteudo(_ livro: LivroDoAutor) -> some View {
        List {
            Section {
                HStack(alignment: .top, spacing: 14) {
                    Capa(url: livro.urlDaCapa, largura: 74)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(livro.titulo)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(Color.tinta)
                        if let subtitulo = livro.subtitulo, !subtitulo.isEmpty {
                            Text(subtitulo).font(.subheadline).foregroundStyle(Color.tintaSuave)
                        }
                        SeloDeEstado(publicado: livro.publicado)
                    }
                    Spacer()
                }
                .padding(.vertical, 6)
            }

            if livro.removidoPorDenuncia {
                Section { Aviso(texto: Copy.livroRemovido) }
            }

            Section {
                Button {
                    Task { await alternarPublicacao(livro) }
                } label: {
                    HStack {
                        Label(
                            livro.publicado ? "Despublicar" : "Publicar",
                            systemImage: livro.publicado ? "eye.slash" : "checkmark.circle"
                        )
                        Spacer()
                        if trabalhando { ProgressView() }
                    }
                }
                // Livro despublicado por denúncia não volta pela mão do dono
                // (regra 11.12) — o servidor recusa, e a tela não oferece.
                .disabled(trabalhando || (livro.removidoPorDenuncia && !livro.publicado))

                Button { lendo = true } label: {
                    Label(livro.publicado ? "Ver livro" : "Ver como ficaria", systemImage: "book")
                }

                if let url = livro.urlPublica {
                    // A folha do sistema: quem compartilha escolhe por onde
                    // (critério C.5). Atalho fixo de WhatsApp está fora do
                    // escopo, de propósito.
                    ShareLink(item: url) {
                        Label("Compartilhar link", systemImage: "square.and.arrow.up")
                    }
                }
            }

            Section("Detalhes") {
                LinhaDeDetalhe("Endereço", valor: caminho(livro))
                LinhaDeDetalhe("Autor", valor: livro.autor)
                if let paginas = livro.totalPaginas {
                    LinhaDeDetalhe("Páginas", valor: "\(paginas)")
                }
                if let bytes = livro.arquivoPdfTamanhoBytes {
                    LinhaDeDetalhe("Tamanho", valor: tamanhoLegivel(bytes: bytes))
                }
                LinhaDeDetalhe("Atualizado", valor: dataLegivel(livro.atualizadoEm))
                Button("Editar informações") { editando = true }
            }

            Section {
                Button {
                    substituindo = true
                } label: {
                    Label("Substituir PDF", systemImage: "arrow.triangle.2.circlepath")
                }
                if envio.etapa != .ocioso {
                    ProgressoDoEnvio(etapa: envio.etapa, progresso: envio.progresso)
                }
            } footer: {
                Text("O arquivo novo vira a capa também — a capa é sempre a primeira página.")
            }

            if let erro {
                Section { Aviso(texto: erro) }
            }

            Section {
                Button(role: .destructive) { confirmandoExclusao = true } label: {
                    Label("Excluir livro", systemImage: "trash")
                }
            } footer: {
                Text("Apaga o livro e o arquivo enviado. O link público para de funcionar.")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .navigationTitle(livro.titulo)
        .confirmationDialog(
            Copy.confirmarExclusao(livro.titulo),
            isPresented: $confirmandoExclusao,
            titleVisibility: .visible
        ) {
            Button("Excluir", role: .destructive) { Task { await excluir(livro) } }
            Button("Cancelar", role: .cancel) {}
        }
        .sheet(isPresented: $editando) {
            EditarLivroView(livro: livro) { atualizado in
                self.livro = atualizado
                await aoMudar()
            }
        }
        .fullScreenCover(isPresented: $lendo) {
            LeitorView(livro: livro)
        }
        .fileImporter(isPresented: $substituindo, allowedContentTypes: [.pdf]) { resultado in
            Task { await substituirPdf(livro, resultado) }
        }
    }

    private func caminho(_ livro: LivroDoAutor) -> String {
        guard let url = livro.urlPublica else { return livro.slug }
        return "\(url.host ?? "")\(url.path)"
    }

    private func carregar() async {
        do {
            livro = try await Api.shared.livro(livroId)
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription
        }
        carregando = false
    }

    private func alternarPublicacao(_ livro: LivroDoAutor) async {
        trabalhando = true
        erro = nil
        defer { trabalhando = false }
        do {
            self.livro = try await Api.shared.publicar(livro.id, publicado: !livro.publicado)
            await aoMudar()
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }

    private func excluir(_ livro: LivroDoAutor) async {
        trabalhando = true
        defer { trabalhando = false }
        do {
            try await Api.shared.excluirLivro(livro.id)
            await aoMudar()
            fechar()
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }

    // O arquivo novo vai para a **mesma pasta** do antigo, porque a sessão de
    // upload recebe o id do livro (pegadinha 10 do CLAUDE.md). A capa é
    // regenerada junto: manter a capa velha sobre um arquivo novo deixaria a
    // vitrine mostrando o que não está mais lá.
    private func substituirPdf(_ livro: LivroDoAutor, _ resultado: Result<URL, Error>) async {
        guard case let .success(origem) = resultado else { return }
        erro = nil

        let precisaLiberar = origem.startAccessingSecurityScopedResource()
        defer { if precisaLiberar { origem.stopAccessingSecurityScopedResource() } }

        let destino = FileManager.default.temporaryDirectory
            .appendingPathComponent(origem.lastPathComponent)
        try? FileManager.default.removeItem(at: destino)
        guard (try? FileManager.default.copyItem(at: origem, to: destino)) != nil else {
            erro = Copy.erroDeUpload
            return
        }
        if let problema = Pdf.validar(destino) {
            erro = problema
            return
        }

        do {
            let enviado = try await envio.enviar(arquivo: destino, livroExistente: livro.id)
            self.livro = try await Api.shared.substituirPdf(
                livro.id,
                tamanhoBytes: enviado.tamanhoBytes,
                totalPaginas: enviado.totalPaginas,
                capaBase64: enviado.capaBase64
            )
            await aoMudar()
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroDeUpload
        }
        envio.cancelar()
    }
}

struct LinhaDeDetalhe: View {
    let rotulo: String
    let valor: String

    init(_ rotulo: String, valor: String) {
        self.rotulo = rotulo
        self.valor = valor
    }

    var body: some View {
        HStack {
            Text(rotulo).foregroundStyle(Color.tintaSuave)
            Spacer()
            Text(valor)
                .foregroundStyle(Color.tinta)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}

// As datas chegam em ISO 8601 do servidor (seção 7 do spec).
func dataLegivel(_ iso: String) -> String {
    let leitor = ISO8601DateFormatter()
    leitor.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let data = leitor.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    guard let data else { return "—" }
    return data.formatted(date: .abbreviated, time: .shortened)
}
