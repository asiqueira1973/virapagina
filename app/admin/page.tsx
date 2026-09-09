// /admin — o painel da plataforma começa na lista de contas (seção 10).
import { redirect } from 'next/navigation'

export default function AdminPage() {
  redirect('/admin/contas')
}
