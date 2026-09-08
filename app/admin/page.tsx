// /admin — não é uma tela: o painel começa na lista de livros (seção 10).
// Quem chega aqui sem sessão já foi parado pelo middleware (critério 8.1).
import { redirect } from 'next/navigation'

export default function AdminPage() {
  redirect('/admin/livros')
}
