// Layout raiz do Virapágina. Carrega as fontes do sistema visual (seção 16) e
// define os metadados padrão de compartilhamento. Interface em pt-BR, sem i18n
// no MVP (seção 17).
import type { Metadata } from 'next'
import { Instrument_Sans, Instrument_Serif } from 'next/font/google'
import { urlDoSite } from '@/lib/site'
import './globals.css'

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})

// metadataBase deixa os links de compartilhamento absolutos. O domínio vem de
// `lib/site.ts`, que o deriva de NEXTAUTH_URL — nunca escrito à mão aqui.
export const metadata: Metadata = {
  metadataBase: new URL(urlDoSite()),
  title: { default: 'Virapágina', template: '%s — Virapágina' },
  description: 'Livros e revistas digitais para folhear no navegador.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable}`}>{children}</body>
    </html>
  )
}
