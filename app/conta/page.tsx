// /conta — não é uma tela: o painel começa na lista de livros (seção 10).
import { redirect } from 'next/navigation'

export default function ContaPage() {
  redirect('/conta/livros')
}
