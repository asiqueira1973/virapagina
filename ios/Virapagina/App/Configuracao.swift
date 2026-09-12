// Os valores que mudam por instalação (spec-ios seção 3).
//
// Eles vêm do `Configuracao.xcconfig` pelo Info.plist, e não do código: trocar o
// servidor ou o client do Google não pode exigir editar Swift, e um id de OAuth
// dentro de um `let` some do radar de quem procura configuração.
import Foundation

enum Configuracao {
    // O servidor. Mesmo host da web — o app é cliente do mesmo backend
    // (princípio 8 do spec-ios).
    static let servidor: URL = {
        let texto = valor("ApiBaseURL")
        guard let url = URL(string: texto), url.scheme != nil else {
            // Falhar alto e cedo: um endereço vazio viraria erro de rede
            // inexplicável em toda tela.
            fatalError("ApiBaseURL ausente ou inválida no Info.plist: \(texto)")
        }
        return url
    }()

    // O client OAuth do tipo iOS. É contra ele que o servidor confere o `aud` do
    // id_token que o app traz do Google.
    static let googleClientID = valor("GoogleClientID")

    // O mesmo id ao contrário: é o esquema de URL que traz o navegador de volta
    // ao app. Derivado, e não configurado duas vezes — duas cópias divergem.
    static var esquemaDeRetorno: String {
        let partes = googleClientID.components(separatedBy: ".apps.googleusercontent.com")
        return "com.googleusercontent.apps.\(partes.first ?? googleClientID)"
    }

    // Diz se a configuração ainda está com os valores de exemplo. A tela de
    // entrar usa isto para explicar o que falta, em vez de abrir um login que
    // fatalmente falharia.
    static var estaConfigurado: Bool {
        !googleClientID.contains("substituaesteclient") && !googleClientID.isEmpty
    }

    private static func valor(_ chave: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: chave) as? String) ?? ""
    }
}
