// Escolher endereço — spec-ios seção 6.2, critérios B.2 e B.3.
//
// O único momento em que a pessoa está logada e não tem para onde ir: sem handle
// não existe URL pública, logo não existe produto (critério 8.1 do spec). A tela
// ocupa tudo e não tem saída além de escolher.
//
// A validação de formato é a mesma da web, com o mesmo texto; a de
// disponibilidade é do servidor, sempre — dois cadastros simultâneos no mesmo
// endereço são resolvidos por transação lá, não por checagem aqui (pegadinha 1
// do CLAUDE.md).
import SwiftUI

struct EscolherEnderecoView: View {
    @EnvironmentObject private var sessao: Sessao

    @State private var handle = ""
    @State private var estado: Estado = .ocioso
    @State private var sugestao: String?
    @State private var erro: String?
    @State private var salvando = false
    @State private var tarefaDeChecagem: Task<Void, Never>?

    // Distingue o endereço que a **pessoa** escreveu do que o produto
    // preencheu — e é o foco que responde, não o valor: as mudanças de um campo
    // digitado rápido chegam agrupadas, e comparar valores já falhou aqui antes,
    // no campo de endereço do livro.
    //
    // Mostrar "já está em uso" sobre uma sugestão que a própria tela escreveu
    // culpa quem acabou de chegar por uma escolha que não foi dele. Foi o que a
    // App Review encontrou no primeiro acesso: todo revisor da Apple se chama
    // "John Apple", e o segundo a testar achou `john-apple` tomado pelo
    // primeiro — tela vermelha e botão desabilitado antes de digitar nada.
    @FocusState private var campoEmFoco: Bool
    @State private var editadoAMao = false
    @State private var jaTrocouSozinho = false

    private enum Estado: Equatable { case ocioso, checando, livre, invalido, ocupado }

    private var dominio: String { Configuracao.servidor.host ?? "virapagina.app.br" }

    var body: some View {
        ZStack {
            Color.tela.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Escolha seu endereço")
                        .font(.system(.largeTitle, design: .serif))
                        .foregroundStyle(Color.tinta)

                    Text("É onde seus livros vão morar. Quem receber o link vai ver este endereço.")
                        .font(.body)
                        .foregroundStyle(Color.tintaSuave)

                    campo

                    if estado == .invalido {
                        Text(Copy.handleInvalido).font(.footnote).foregroundStyle(Color.perigo)
                    }
                    if estado == .ocupado {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(Copy.handleIndisponivel).font(.footnote).foregroundStyle(Color.perigo)
                            if let sugestao {
                                Button("Usar \(sugestao)") { handle = sugestao; checar() }
                                    .font(.footnote.weight(.semibold))
                            }
                        }
                    }
                    if let erro { Aviso(texto: erro) }

                    Aviso(texto: Copy.handleDefinitivo, perigo: false)

                    BotaoPrimario(
                        titulo: "Continuar",
                        carregando: salvando,
                        habilitado: estado == .livre
                    ) {
                        Task { await continuar() }
                    }

                    Button("Sair") { sessao.sair() }
                        .font(.footnote)
                        .foregroundStyle(Color.tintaFraca)
                        .frame(maxWidth: .infinity)
                }
                .padding(24)
            }
        }
        .onAppear(perform: sugerirDoNome)
    }

    private var campo: some View {
        HStack(spacing: 2) {
            Text("\(dominio)/")
                .foregroundStyle(Color.tintaFraca)
            TextField("seu-nome", text: $handle)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($campoEmFoco)
                .onChange(of: handle) { _, novo in
                    if campoEmFoco { editadoAMao = true }
                    // Normaliza enquanto digita: o formato aceito é minúsculas,
                    // números e hífen (critério 8.1).
                    let limpo = novo.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "-" }
                    if limpo != novo { handle = limpo }
                    checar()
                }
            if estado == .checando { ProgressView().controlSize(.small) }
            if estado == .livre {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.publicado)
            }
        }
        .padding(14)
        .background(Color.superficie)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.hairline, lineWidth: 1)
        )
    }

    // Sugere a partir do nome do Google, como na web.
    private func sugerirDoNome() {
        guard handle.isEmpty, let conta = sessao.conta else { return }
        let base = conta.nome ?? conta.email.components(separatedBy: "@").first ?? ""
        handle = base
            .folding(options: .diacriticInsensitive, locale: .init(identifier: "pt_BR"))
            .lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .filter { $0.isLetter || $0.isNumber || $0 == "-" }
        checar()
    }

    // Espera a digitação parar antes de perguntar ao servidor: uma requisição
    // por tecla transformaria a escolha do endereço numa rajada.
    private func checar() {
        tarefaDeChecagem?.cancel()
        sugestao = nil
        guard handle.count >= 3, handle.count <= 30 else {
            estado = handle.isEmpty ? .ocioso : .invalido
            return
        }
        estado = .checando
        tarefaDeChecagem = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            do {
                let resposta = try await Api.shared.handleDisponivel(handle)
                guard !Task.isCancelled else { return }

                // Sugerido pelo produto e tomado: adota a alternativa livre em
                // silêncio, uma vez só. O limite de uma troca evita laço se a
                // alternativa também estiver ocupada — aí o aviso aparece, e aí
                // ele é honesto.
                if !resposta.disponivel, resposta.valido, !editadoAMao, !jaTrocouSozinho,
                   let livre = resposta.sugestao {
                    jaTrocouSozinho = true
                    handle = livre
                    return
                }

                sugestao = resposta.sugestao
                estado = !resposta.valido ? .invalido : (resposta.disponivel ? .livre : .ocupado)
            } catch {
                sessao.tratar(error)
                estado = .ocioso
                erro = (error as? ErroDaApi)?.errorDescription
            }
        }
    }

    private func continuar() async {
        salvando = true
        erro = nil
        defer { salvando = false }
        do {
            try await Api.shared.definirHandle(handle)
            // A conta é relida do servidor: é ela que tira esta tela do caminho.
            await sessao.recarregarConta()
        } catch let ErroDaApi.emUso(mensagem, sugerido) {
            estado = .ocupado
            sugestao = sugerido
            erro = mensagem
        } catch {
            sessao.tratar(error)
            erro = (error as? ErroDaApi)?.errorDescription ?? Copy.erroGenerico
        }
    }
}
