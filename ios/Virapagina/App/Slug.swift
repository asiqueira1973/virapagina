// O slug do livro, como em `lib/slug.ts` (regra 11.3).
//
// A cópia no app existe só para **sugerir** enquanto a pessoa digita o título: a
// validação e a unicidade continuam sendo do servidor, que é quem lê a conta
// inteira antes de gravar. Se as duas versões divergirem, a que vale é a de lá.
import Foundation

enum Slug {
    static func criar(de texto: String) -> String {
        let semAcento = texto.folding(
            options: [.diacriticInsensitive, .caseInsensitive],
            locale: Locale(identifier: "pt_BR")
        )
        var resultado = ""
        var hifenPendente = false
        for caractere in semAcento.lowercased() {
            if caractere.isLetter || caractere.isNumber {
                if hifenPendente && !resultado.isEmpty { resultado.append("-") }
                hifenPendente = false
                resultado.append(caractere)
            } else {
                hifenPendente = true
            }
        }
        return resultado
    }
}
