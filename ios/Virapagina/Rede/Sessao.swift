// O estado de quem está usando o app (spec-ios épico B).
//
// Uma fonte só de verdade para três perguntas que toda tela faz: tem alguém
// logado? essa pessoa já escolheu o endereço público? qual é o plano dela?
//
// O token vive no Keychain; a conta, em memória. Recarregar a conta é barato e
// acontece depois de toda ação que possa mudá-la — publicar um livro, assinar,
// excluir. Guardá-la em disco criaria um segundo lugar onde o plano pode estar
// errado.
import Foundation
import SwiftUI

@MainActor
final class Sessao: ObservableObject {
    enum Estado: Equatable {
        // Enquanto o token do Keychain é conferido contra o servidor. Dura o
        // tempo de uma requisição e evita a tela de entrar piscando para quem
        // já está logado.
        case verificando
        case fora
        // Logado, mas sem endereço público: a tela de escolha ocupa tudo e não
        // é pulável (critério B.2).
        case semEndereco(ContaDoApp)
        case dentro(ContaDoApp)
    }

    @Published private(set) var estado: Estado = .verificando
    @Published var entrando = false
    @Published var erro: String?

    private let api = Api.shared
    private let login = LoginGoogle()

    var conta: ContaDoApp? {
        switch estado {
        case let .semEndereco(conta), let .dentro(conta): return conta
        default: return nil
        }
    }

    // Chamada na abertura do app. Token ausente ou vencido cai em `.fora` sem
    // mensagem de erro: não é falha, é a primeira vez.
    func restaurar() async {
        // Entrada de teste, só em build de depuração: um token emitido pelo
        // servidor local, passado no ambiente do processo.
        //
        // Existe por um motivo prático e um cuidado. O prático: o login de
        // verdade passa pela folha do Google, que no simulador empurra passkey —
        // e passkey entre aparelhos precisa de Bluetooth, que o simulador não
        // tem. Sem isto, capturar screenshot da loja exigiria um iPhone físico.
        // O cuidado: `#if DEBUG` some no Release, então **não existe** caminho de
        // sessão sem Google no app que vai para a App Store.
        #if DEBUG
        if let deTeste = ProcessInfo.processInfo.environment["VIRAPAGINA_TOKEN_DE_TESTE"],
           !deTeste.isEmpty {
            api.token = deTeste
            do {
                aplicar(try await api.conta())
                return
            } catch {
                estado = .fora
                erro = "Token de teste recusado pelo servidor."
                return
            }
        }
        #endif

        guard let token = Chaveiro.ler() else {
            estado = .fora
            return
        }
        api.token = token
        do {
            aplicar(try await api.conta())
        } catch ErroDaApi.naoAutenticado {
            sair()
        } catch {
            // Sem rede na abertura: não dá para saber se o token vale. Manter a
            // pessoa "dentro" mentiria sobre o que o app consegue fazer.
            estado = .fora
            erro = Copy.semRede
        }
    }

    func entrar() async {
        guard Configuracao.estaConfigurado else {
            erro = Copy.naoConfigurado
            return
        }
        entrando = true
        erro = nil
        defer { entrando = false }

        do {
            let idToken = try await login.idToken()
            let aberta = try await api.abrirSessao(idTokenDoGoogle: idToken)
            Chaveiro.guardar(aberta.token)
            api.token = aberta.token
            aplicar(aberta.conta)
        } catch ErroDoLogin.cancelado {
            // Fechar a folha do Google é uma decisão, não um erro.
        } catch let erroDaApi as ErroDaApi {
            erro = erroDaApi.errorDescription
        } catch {
            erro = Copy.entrarErro
        }
    }

    func sair() {
        Chaveiro.apagar()
        api.token = nil
        estado = .fora
    }

    // Relê a conta no servidor. Toda tela que muda plano, handle ou quantidade
    // de livros termina aqui.
    func recarregarConta() async {
        guard api.token != nil else { return }
        do {
            aplicar(try await api.conta())
        } catch ErroDaApi.naoAutenticado {
            sair()
        } catch {
            // Falha de rede não derruba ninguém: o estado anterior continua
            // valendo e a tela mostra o que já tinha.
        }
    }

    // O 401 de qualquer tela passa por aqui: token vencido devolve a pessoa ao
    // login sem mensagem técnica (spec-ios seção 3).
    func tratar(_ erro: Error) {
        if case ErroDaApi.naoAutenticado = erro { sair() }
    }

    private func aplicar(_ conta: ContaDoApp) {
        estado = conta.handle == nil ? .semEndereco(conta) : .dentro(conta)
    }
}
