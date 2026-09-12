// O leitor, em PDFKit (spec-ios seção 6.7).
//
// Página a página, na horizontal, com a virada do próprio sistema. **Não** é o
// flipbook do site: lá é `react-pageflip` com PDF.js, aqui é o componente da
// Apple, e a diferença está declarada na seção 14 do spec-ios. O que não muda é
// a regra que importa — o PDF original é a fonte, renderizado no cliente.
import PDFKit
import SwiftUI

struct LeitorPdf: UIViewRepresentable {
    let arquivo: URL
    @Binding var paginaAtual: Int
    @Binding var totalDePaginas: Int

    func makeUIView(context: Context) -> PDFView {
        let vista = PDFView()
        vista.displayMode = .singlePage
        vista.displayDirection = .horizontal
        vista.usePageViewController(true, withViewOptions: nil)
        vista.autoScales = true
        // O fundo do leitor é sempre escuro, como na web.
        vista.backgroundColor = UIColor(white: 0.07, alpha: 1)
        let documento = PDFDocument(url: arquivo)
        vista.document = documento
        // Fora do ciclo de construção da view: escrever estado do SwiftUI aqui
        // dentro é ignorado (e a barra ficava com "—" no lugar de "1 de 12").
        DispatchQueue.main.async {
            totalDePaginas = documento?.pageCount ?? 0
            paginaAtual = 1
        }

        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.mudouDePagina(_:)),
            name: .PDFViewPageChanged,
            object: vista
        )
        return vista
    }

    func updateUIView(_ vista: PDFView, context: Context) {
        context.coordinator.aoMudar = { numero in
            // A notificação chega durante o layout do PDFKit; publicar o estado
            // no mesmo ciclo faz o SwiftUI reclamar de mudança durante a
            // atualização da vista.
            DispatchQueue.main.async { paginaAtual = numero }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject {
        var aoMudar: ((Int) -> Void)?

        @objc func mudouDePagina(_ notificacao: Notification) {
            guard let vista = notificacao.object as? PDFView,
                  let documento = vista.document,
                  let pagina = vista.currentPage
            else { return }
            aoMudar?(documento.index(for: pagina) + 1)
        }
    }
}
