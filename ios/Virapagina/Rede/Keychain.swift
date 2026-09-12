// Onde o token do app dorme (spec-ios seção 3).
//
// Keychain, e não `UserDefaults`: `UserDefaults` vai inteiro para o backup do
// iCloud e para qualquer cópia do contêiner do app, em texto puro.
//
// `kSecAttrAccessibleAfterFirstUnlock` e **sem** sincronização: o token vale
// para este aparelho. Sincronizá-lo pelo iCloud espalharia uma credencial de 30
// dias por todos os aparelhos da conta Apple, inclusive os que nunca abriram o
// Virapágina.
import Foundation
import Security

enum Chaveiro {
    private static let servico = "app.br.virapagina.ios"
    private static let conta = "token-do-app"

    static func guardar(_ token: String) {
        apagar()
        let item: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servico,
            kSecAttrAccount as String: conta,
            kSecValueData as String: Data(token.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(item as CFDictionary, nil)
    }

    static func ler() -> String? {
        let consulta: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servico,
            kSecAttrAccount as String: conta,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var resultado: AnyObject?
        guard SecItemCopyMatching(consulta as CFDictionary, &resultado) == errSecSuccess,
              let dados = resultado as? Data
        else { return nil }
        return String(data: dados, encoding: .utf8)
    }

    static func apagar() {
        let consulta: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servico,
            kSecAttrAccount as String: conta,
        ]
        SecItemDelete(consulta as CFDictionary)
    }
}
