// Novo livro — spec-ios seção 6.4, critérios C.2 e C.3.
//
// O PDF é lido no aparelho (capa e total de páginas), sobe direto para o Storage
// por uma sessão que o servidor abre, e só então o livro é criado — nessa ordem,
// que é a do fluxo da seção 9 do spec: nenhum documento nasce antes de o arquivo
// estar lá.
//
// Erro em qualquer passo **mantém os campos preenchidos**. Perder o formulário
// depois de um upload de 80 MB que falhou no fim é o que faz alguém desistir do
// produto.
import SwiftUI
import UniformTypeIdentifiers

struct NovoLivroView: View {
    let aoCriar: () async -> Void

    @EnvironmentObject private var sessao: Sessao
    @Environment(\.dismiss) private var fechar
    @StateObject private var envio = EnvioDePdf()

    @State private var metadados = MetadadosDoLivro()
    @State private var arquivo: URL?
    @State private var escolhendoArquivo = false
    @State private var erro: String?
    @State private var erroDeSlug: String?
    @State private var sugestaoDeSlug: String?
    @State private var salvando = false
    @State private var mostrandoPaywall = false

    var body: some View {
        NavigationStack {
            Form {
                CamposDoLivro(
                    metadados: $metadados,
                    handle: sessao.conta?.handle ?? "",
                    erroDeSlug: erroDeSlug,
                    sugestaoDeSlug: sugestaoDeSlug,
                    aoUsarSugestao: usarSugestao
                )

                Section("Arquivo") {
                    Button {
                        escolhendoArquivo = true
                    } label: {
                        HStack {
                            Image(systemName: "doc.badge.plus")
                            Text(arquivo == nil ? "Escolher PDF" : (arquivo?.lastPathComponent ?? ""))
                                .lineLimit(1)
                            Spacer()
                            if arquivo != nil {
                                Image(systemName: "checkmark").foregroundStyle(Color.publicado)
                            }
                        }
                    }
                    if let arquivo {
                        Text(tamanhoLegivel(de: arquivo))
                            .font(.caption)
                            .foregroundStyle(Color.tintaFraca)
                    }
                }

                if salvando {
                    Section { ProgressoDoEnvio(etapa: envio.etapa, progresso: envio.progresso) }
                }

                if let erro {
                    Section { Aviso(texto: erro) }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.tela)
            .navigationTitle("Novo livro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { envio.cancelar(); fechar() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") { Task { await salvar() } }
                        .disabled(!podeSalvar)
                }
            }
            .fileImporter(
                isPresented: $escolhendoArquivo,
                allowedContentTypes: [.pdf]
            ) { resultado in
                escolher(resultado)
            }
            .sheet(isPresented: $mostrandoPaywall) { PaywallView() }
            .interactiveDismissDisabled(salvando)
        }
    }

    private var podeSalvar: Bool {
        !metadados.titulo.trimmingCharacters(in: .whitespaces).isEmpty && arquivo != nil && !salvando
    }

    // O arquivo escolhido vive numa pasta de outro app (Arquivos, iCloud), com
    // acesso por escopo. Copiá-lo para a nossa pasta temporária é o que permite
    // lê-lo depois, durante o upload inteiro.
    private func escolher(_ resultado: Result<URL, Error>) {
        erro = nil
        guard case let .success(origem) = resultado else { return }

        let precisaLiberar = origem.startAccessingSecurityScopedResource()
        defer { if precisaLiberar { origem.stopAccessingSecurityScopedResource() } }

        let destino = FileManager.default.temporaryDirectory
            .appendingPathComponent(origem.lastPathComponent)
        try? FileManager.default.removeItem(at: destino)
        do {
            try FileManager.default.copyItem(at: origem, to: destino)
        } catch {
            erro = Copy.erroDeUpload
            return
        }

        // A checagem do app é a que dá a mensagem; a do servidor é a que vale
        // (regra iOS 10.8).
        if let problema = Pdf.validar(destino) {
            erro = problema
            try? FileManager.default.removeItem(at: destino)
            return
        }

        arquivo = destino
        if metadados.autor.isEmpty {
            metadados.autor = sessao.conta?.nome ?? sessao.conta?.email ?? ""
        }
    }

    private func usarSugestao() {
        guard let sugestaoDeSlug else { return }
        metadados.slug = sugestaoDeSlug
        self.sugestaoDeSlug = nil
        erroDeSlug = nil
    }

    private func salvar() async {
        guard let arquivo else { return }
        salvando = true
        erro = nil
        erroDeSlug = nil
        sugestaoDeSlug = nil
        defer { salvando = false }

        do {
            let enviado = try await envio.enviar(arquivo: arquivo)
            _ = try await Api.shared.criarLivro(
                metadados: metadados,
                livroId: enviado.livroId,
                tamanhoBytes: enviado.tamanhoBytes,
                totalPaginas: enviado.totalPaginas,
                capaBase64: enviado.capaBase64
            )
            await aoCriar()
            fechar()
        } catch let ErroDaApi.emUso(mensagem, sugestao) {
            erroDeSlug = mensagem
            sugestaoDeSlug = sugestao
        } catch let ErroDaApi.limiteAtingido(mensagem) {
            // Chegou ao limite entre abrir o formulário e salvar — ou o limite
            // mudou noutro aparelho. O caminho é o mesmo do `+`: o paywall.
            erro = mensagem
            mostrandoPaywall = true
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }
}

func tamanhoLegivel(de url: URL) -> String {
    let bytes = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    return tamanhoLegivel(bytes: bytes)
}

func tamanhoLegivel(bytes: Int) -> String {
    let formatador = ByteCountFormatter()
    formatador.countStyle = .file
    return formatador.string(fromByteCount: Int64(bytes))
}
