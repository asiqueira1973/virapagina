// O Login com Apple (spec-ios seção 3, critério B.5).
//
// Bem menos código que o do Google, porque aqui não há navegador no meio: o
// sistema já conhece a conta Apple do aparelho e devolve um `identityToken`
// assinado. O botão também é da Apple — `SignInWithAppleButton` —, o que resolve
// de uma vez a tradução e as regras de forma e tamanho que a revisão cobra.
//
// O que sai daqui é o token e, **só na primeira autorização**, o nome. Quem
// decide se o token vale é o servidor.
import AuthenticationServices
import Foundation

enum LoginApple {
    struct Resultado {
        let identityToken: String
        // A Apple só manda o nome uma vez na vida, na primeira autorização. Se
        // não for aproveitado agora, não volta — e a conta fica sem nome.
        let nome: String?
    }

    // Traduz o que o botão devolve. `nil` significa "a pessoa desistiu", que não
    // é erro e não merece mensagem.
    static func ler(_ resultado: Result<ASAuthorization, Error>) throws -> Resultado? {
        switch resultado {
        case let .success(autorizacao):
            guard let credencial = autorizacao.credential as? ASAuthorizationAppleIDCredential,
                  let dados = credencial.identityToken,
                  let token = String(data: dados, encoding: .utf8)
            else { throw ErroDoLogin.falhou }

            return Resultado(identityToken: token, nome: nomeDe(credencial))

        case let .failure(erro):
            if let erroDaApple = erro as? ASAuthorizationError, erroDaApple.code == .canceled {
                return nil
            }
            throw ErroDoLogin.falhou
        }
    }

    private static func nomeDe(_ credencial: ASAuthorizationAppleIDCredential) -> String? {
        guard let partes = credencial.fullName else { return nil }
        let nome = PersonNameComponentsFormatter.localizedString(from: partes, style: .default)
        return nome.trimmingCharacters(in: .whitespaces).isEmpty ? nil : nome
    }
}
