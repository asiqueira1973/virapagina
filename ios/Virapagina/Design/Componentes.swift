// As poucas peças visuais que se repetem (spec-ios seção 10).
//
// Poucas de propósito: o app usa componente do sistema sempre que existe um.
// Botão de voltar desenhado à mão, lista feita de VStack e campo de texto
// próprio são o que faz um app parecer feito por quem não usa iPhone.
import SwiftUI

// O botão primário — o azul de destaque, cheio, largura total.
struct BotaoPrimario: View {
    let titulo: String
    var carregando = false
    var habilitado = true
    let acao: () -> Void

    var body: some View {
        Button(action: acao) {
            ZStack {
                Text(titulo).opacity(carregando ? 0 : 1)
                if carregando { ProgressView().tint(.white) }
            }
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(habilitado && !carregando ? Color.destaque : Color.destaque.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .disabled(!habilitado || carregando)
    }
}

// O selo de estado do livro. Verde para publicado, cinza para rascunho —
// nunca azul, que é a cor da marca (spec seção 16).
struct SeloDeEstado: View {
    let publicado: Bool

    var body: some View {
        Text(publicado ? "Publicado" : "Rascunho")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(publicado ? Color.publicado : Color.tintaSuave)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(publicado ? Color.publicadoFundo : Color.preenchimento)
            .clipShape(Capsule())
    }
}

// O aviso de erro das telas de formulário. Vermelho é só para perigo e alerta.
struct Aviso: View {
    let texto: String
    var perigo = true

    var body: some View {
        Text(texto)
            .font(.footnote)
            .foregroundStyle(perigo ? Color.perigo : Color.tintaSuave)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(perigo ? Color.perigoFundo : Color.preenchimento)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

// A tela de "ainda não há nada aqui", usada na lista vazia e nos erros de
// carregamento. Nunca uma tela em branco (spec-ios seção 11).
struct EstadoVazio: View {
    let icone: String
    let titulo: String
    var descricao: String?
    var acao: (titulo: String, executar: () -> Void)?

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: icone)
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Color.tintaFraca)
            Text(titulo)
                .font(.headline)
                .foregroundStyle(Color.tinta)
            if let descricao {
                Text(descricao)
                    .font(.subheadline)
                    .foregroundStyle(Color.tintaSuave)
                    .multilineTextAlignment(.center)
            }
            if let acao {
                Button(acao.titulo, action: acao.executar)
                    .font(.body.weight(.semibold))
                    .padding(.top, 4)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity)
    }
}

// A capa de um livro, no tamanho pequeno da lista e no grande da tela do livro.
// Livro sem capa é estado previsto (`capa_caminho` nulo, spec seção 7).
struct Capa: View {
    let url: URL?
    var largura: CGFloat = 44

    var body: some View {
        AsyncImageAutenticada(url: url) { imagem in
            imagem.resizable().aspectRatio(contentMode: .fill)
        } vazio: {
            ZStack {
                Color.preenchimento
                Image(systemName: "doc.text")
                    .foregroundStyle(Color.tintaFraca)
                    .font(.system(size: largura * 0.35, weight: .light))
            }
        }
        .frame(width: largura, height: largura * 1.4)
        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .stroke(Color.hairline, lineWidth: 1)
        )
    }
}
