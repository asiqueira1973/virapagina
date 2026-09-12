// Os campos que criar e editar um livro têm em comum (spec-ios seções 6.4 e 6.6).
//
// Um arquivo só para que os dois formulários não divirjam: foi assim que, na
// web, o campo de autor apareceu em um e sumiu do outro.
import SwiftUI

struct CamposDoLivro: View {
    @Binding var metadados: MetadadosDoLivro
    let handle: String
    // Erro de slug vindo do servidor, com a sugestão que ele calculou.
    var erroDeSlug: String?
    var sugestaoDeSlug: String?
    var aoUsarSugestao: (() -> Void)?

    // O slug segue o título até alguém digitar **no campo do slug**.
    //
    // Quem responde por "alguém digitou" é o foco, não o valor. Duas tentativas
    // anteriores compararam valores — um sinalizador de escrita programática e a
    // comparação com o slug do título anterior — e as duas falharam pelo mesmo
    // motivo: o SwiftUI agrupa as mudanças de um campo digitado rápido, então o
    // par (valor antigo, valor novo) que chega aqui não corresponde ao que está
    // no outro campo naquele instante. Digitar "Cerrado" parava o endereço em
    // "cer". O foco não tem esse problema: ou o cursor está no campo do slug, ou
    // não está.
    @FocusState private var slugEmFoco: Bool
    @State private var slugEditadoAMao = false


    var body: some View {
        Section("O livro") {
            // Sem corretor nos três: título, subtítulo e nome de autor são
            // nomes próprios, e o corretor do iOS os reescreve com confiança —
            // "o que floresce depois do fogo" virou "O que Florence Delois do
            // forgo" na primeira vez que este formulário foi usado.
            TextField("Título", text: $metadados.titulo)
                .autocorrectionDisabled()
                .onChange(of: metadados.titulo) { _, novo in
                    if !slugEditadoAMao { metadados.slug = Slug.criar(de: novo) }
                }
            TextField("Subtítulo (opcional)", text: $metadados.subtitulo)
                .autocorrectionDisabled()
            TextField("Autor", text: $metadados.autor)
                .autocorrectionDisabled()
        }

        Section {
            HStack(spacing: 2) {
                Text("/\(handle)/")
                    .foregroundStyle(Color.tintaFraca)
                TextField("endereco-do-livro", text: $metadados.slug)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($slugEmFoco)
                    .onChange(of: metadados.slug) { _, novo in
                        // Mudança com o cursor aqui dentro é edição à mão; a que
                        // vem do título, não.
                        if slugEmFoco { slugEditadoAMao = true }
                        let limpo = Slug.criar(de: novo)
                        if limpo != novo { metadados.slug = limpo }
                    }
            }
            if let erroDeSlug {
                Text(erroDeSlug).font(.footnote).foregroundStyle(Color.perigo)
            }
            if let sugestaoDeSlug, let aoUsarSugestao {
                Button("Usar \(sugestaoDeSlug)", action: aoUsarSugestao)
                    .font(.footnote.weight(.semibold))
            }
        } header: {
            Text("Endereço do livro")
        } footer: {
            Text("É o link que você vai compartilhar.")
        }

        Section("Descrição (opcional)") {
            TextField("Sobre o que é este livro", text: $metadados.descricao, axis: .vertical)
                .lineLimit(3...6)
        }
    }
}

// A barra de progresso das três etapas nomeadas do envio (spec seção 9).
struct ProgressoDoEnvio: View {
    let etapa: EnvioDePdf.Etapa
    let progresso: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(etapa.descricao)
                .font(.footnote)
                .foregroundStyle(Color.tintaSuave)
            // Determinada só no envio: nas outras duas etapas não há fração real
            // a mostrar, e uma barra fingindo progresso é pior que nenhuma.
            if etapa == .enviando {
                ProgressView(value: progresso)
            } else {
                ProgressView().progressViewStyle(.linear)
            }
        }
    }
}
