// O login com o Google, sem SDK (spec-ios seções 2 e 3).
//
// É o fluxo que o próprio SDK do Google faz por dentro no iOS: consentimento em
// `ASWebAuthenticationSession`, código de autorização com **PKCE**, troca do
// código por `id_token` direto no Google. Sem PKCE, um app malicioso registrado
// no mesmo esquema de URL interceptaria o código e o trocaria por uma identidade
// — é para isso que o desafio existe, e é por isso que client nativo não tem
// segredo.
//
// O que sai daqui é só o `id_token`. Quem decide se ele vale é o servidor.
import AuthenticationServices
import CryptoKit
import Foundation

enum ErroDoLogin: Error {
    case cancelado
    case falhou
}

@MainActor
final class LoginGoogle: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var sessaoWeb: ASWebAuthenticationSession?

    func idToken() async throws -> String {
        let verificador = Self.aleatorioEmBase64url(bytes: 64)
        let desafio = Self.sha256EmBase64url(verificador)
        let redirecionamento = "\(Configuracao.esquemaDeRetorno):/oauth2redirect"

        var componentes = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        componentes.queryItems = [
            .init(name: "client_id", value: Configuracao.googleClientID),
            .init(name: "redirect_uri", value: redirecionamento),
            .init(name: "response_type", value: "code"),
            // `openid email profile` é o mínimo: o servidor precisa do `sub`, do
            // e-mail e do nome, e de nada mais.
            .init(name: "scope", value: "openid email profile"),
            .init(name: "code_challenge", value: desafio),
            .init(name: "code_challenge_method", value: "S256"),
        ]

        let codigo = try await autorizar(url: componentes.url!, esquema: Configuracao.esquemaDeRetorno)
        return try await trocarPorIdToken(
            codigo: codigo,
            verificador: verificador,
            redirecionamento: redirecionamento
        )
    }

    // Abre a folha do sistema e espera a volta pelo esquema do app.
    private func autorizar(url: URL, esquema: String) async throws -> String {
        try await withCheckedThrowingContinuation { continuacao in
            let sessao = ASWebAuthenticationSession(url: url, callbackURLScheme: esquema) { retorno, erro in
                if let erro = erro as? ASWebAuthenticationSessionError, erro.code == .canceledLogin {
                    continuacao.resume(throwing: ErroDoLogin.cancelado)
                    return
                }
                guard let retorno,
                      let itens = URLComponents(url: retorno, resolvingAgainstBaseURL: false)?.queryItems,
                      let codigo = itens.first(where: { $0.name == "code" })?.value
                else {
                    continuacao.resume(throwing: ErroDoLogin.falhou)
                    return
                }
                continuacao.resume(returning: codigo)
            }
            sessao.presentationContextProvider = self
            // Sessão efêmera **não**: reaproveitar o login do Google que a pessoa
            // já tem no Safari é o que faz entrar custar um toque.
            sessao.prefersEphemeralWebBrowserSession = false
            self.sessaoWeb = sessao
            sessao.start()
        }
    }

    private func trocarPorIdToken(
        codigo: String,
        verificador: String,
        redirecionamento: String
    ) async throws -> String {
        var pedido = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        pedido.httpMethod = "POST"
        pedido.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        var corpo = URLComponents()
        corpo.queryItems = [
            .init(name: "client_id", value: Configuracao.googleClientID),
            .init(name: "code", value: codigo),
            .init(name: "code_verifier", value: verificador),
            .init(name: "grant_type", value: "authorization_code"),
            .init(name: "redirect_uri", value: redirecionamento),
        ]
        pedido.httpBody = corpo.percentEncodedQuery.map { Data($0.utf8) }

        let (dados, resposta) = try await URLSession.shared.data(for: pedido)
        guard let http = resposta as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let json = try? JSONSerialization.jsonObject(with: dados) as? [String: Any],
              let idToken = json["id_token"] as? String
        else { throw ErroDoLogin.falhou }
        return idToken
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let cena = UIApplication.shared.connectedScenes.first as? UIWindowScene
        return cena?.keyWindow ?? ASPresentationAnchor()
    }

    // --- PKCE ---

    private static func aleatorioEmBase64url(bytes: Int) -> String {
        var dados = Data(count: bytes)
        _ = dados.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, bytes, $0.baseAddress!) }
        return base64url(dados)
    }

    private static func sha256EmBase64url(_ texto: String) -> String {
        base64url(Data(SHA256.hash(data: Data(texto.utf8))))
    }

    private static func base64url(_ dados: Data) -> String {
        dados.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
