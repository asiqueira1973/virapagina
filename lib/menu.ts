// Quais grupos o menu lateral do painel mostra, e para quem (spec seção 16).
//
// Fica no servidor de propósito: decidir isto no `Sidebar`, que é componente de
// cliente, levaria `ADMIN_ALLOWED_EMAILS` para o pacote do navegador — e a
// allowlist não tem o que fazer lá.
//
// Note que isto é **conveniência de navegação, não autorização**. Esconder o
// grupo não protege nada: quem proteje `/admin` é o layout de lá, que devolve
// 404 para quem não é admin (critério 8.7). Se esta função errasse e mostrasse o
// grupo a um autor comum, ele veria um link que abre uma página não encontrada.
import { isAdminEmail } from '@/lib/admins'

export interface ItemDeMenu {
  href: string
  rotulo: string
}

export interface GrupoDeMenu {
  titulo: string
  itens: ItemDeMenu[]
}

const LIVROS: GrupoDeMenu = {
  titulo: 'Livros',
  itens: [{ href: '/conta/livros', rotulo: 'Meus livros' }],
}

const PLATAFORMA: GrupoDeMenu = {
  titulo: 'Plataforma',
  itens: [{ href: '/admin/contas', rotulo: 'Contas' }],
}

// O menu dos dois painéis, montado a partir de quem está logado.
//
// Os dois grupos aparecem juntos para o admin da plataforma, e o menu é o mesmo
// dos dois lados. É o que faz existir caminho de volta: sem isso, quem entrasse
// em /admin só sairia pela home — e o painel da plataforma, que não tem link em
// lugar nenhum, seria descoberto por acaso, como de fato foi.
export function gruposDoPainel(email: string): GrupoDeMenu[] {
  return isAdminEmail(email) ? [LIVROS, PLATAFORMA] : [LIVROS]
}
