// / — home pública (spec seção 10, épico 8.6).
//
// Explica o produto em menos de dez segundos e leva ao cadastro. Não menciona
// preço nem plano pago: eles não existem no v3 (assunção 24.10).
import type { Metadata } from 'next'
import Link from 'next/link'
import { CabecalhoPublico, RodapePublico } from '@/components/marketing/Chrome'

export const metadata: Metadata = {
  title: { absolute: 'Virapágina — livros e revistas para folhear no navegador' },
  description:
    'Suba seu PDF e receba um link onde as pessoas folheiam o livro no navegador, sem instalar nada e sem criar conta.',
}

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-tela">
      <CabecalhoPublico />

      <main className="flex-1">
        {/* `min-w-0` nos dois filhos não é enfeite: item de grid não encolhe
            abaixo do próprio conteúdo, então um filho largo estica a coluna e
            arrasta o texto junto — foi assim que a home passou a vazar para fora
            da tela no iPhone. */}
        <section className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 py-14 sm:px-12 lg:grid-cols-2 lg:gap-16 lg:py-[72px]">
          <div className="min-w-0">
            <h1 className="mb-5 font-display text-[38px] leading-[1.06] tracking-[-0.02em] text-pretty sm:text-[52px]">
              Seu PDF vira um livro que dá vontade de folhear
            </h1>
            <p className="mb-7 max-w-[44ch] text-[16px] leading-relaxed text-tinta-suave text-pretty">
              Suba o arquivo, escolha o endereço e pronto: quem receber o link abre no navegador
              e vira as páginas — no computador ou no celular, sem instalar nada.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/entrar"
                className="rounded-[10px] bg-acao px-5 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-acao-clara"
              >
                Começar de graça
              </Link>
              <span className="text-[13px] text-tinta-apagada">5 livros, sem cartão</span>
            </div>
          </div>

          <LivroDeExemplo />
        </section>

        <section className="mx-auto max-w-[1180px] px-6 pb-[72px] sm:px-12">
          <div className="grid gap-5 sm:grid-cols-3">
            <Argumento
              titulo="Sem marca d'água"
              caminho="M4 5h16v14H4z M4 15l5-5 4 4 3-3 4 4"
            >
              O plano gratuito publica o livro inteiro, limpo. Nada de carimbo no canto da página
              nem aviso de teste no meio da leitura.
            </Argumento>
            <Argumento
              titulo="Nada sai do ar"
              caminho="M12 3l7 4v5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V7z M9 12l2 2 4-4"
            >
              O link que você espalhou continua funcionando. Chegar no limite impede publicar o
              próximo livro — nunca tira do ar os que já estão lá.
            </Argumento>
            <Argumento
              titulo="Quem lê não faz conta"
              caminho="M12 5c-4 0-7.5 2.6-9 7 1.5 4.4 5 7 9 7s7.5-2.6 9-7c-1.5-4.4-5-7-9-7z M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"
            >
              Sem cadastro, sem login, sem cookie de rastreio. A pessoa abre o link e já está
              lendo — que é o único jeito de alguém ler mesmo.
            </Argumento>
          </div>
        </section>
      </main>

      <RodapePublico />
    </div>
  )
}

// Um dos três argumentos da home. O ícone é SVG inline, nunca emoji.
function Argumento({
  titulo,
  caminho,
  children,
}: {
  titulo: string
  caminho: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-superficie p-6">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mb-3.5 text-tinta"
      >
        <path d={caminho} />
      </svg>
      <h2 className="mb-1.5 text-[15px] font-semibold">{titulo}</h2>
      <p className="text-[13px] leading-relaxed text-tinta-suave">{children}</p>
    </div>
  )
}

// Ilustração de um livro aberto. É decorativa: o exemplo folheável de verdade
// depende de um livro publicado, e o v3 nasce sem nenhum (seção 8.6 e
// assunção 24.8).
function LivroDeExemplo() {
  return (
    <div className="flex min-w-0 justify-center" aria-hidden="true">
      <div className="flex overflow-hidden rounded-[3px] shadow-[0_18px_48px_rgba(23,24,26,0.16)]">
        <div className="h-[288px] w-[208px] bg-superficie px-5 py-[22px] min-[480px]:border-r min-[480px]:border-[#e9e9eb]">
          <div className="mb-3.5 font-display text-[19px] leading-tight">
            Conceitos de Tecnologia
          </div>
          <div className="flex flex-col gap-[7px]">
            <Linha largura="100%" />
            <Linha largura="92%" />
            <Linha largura="97%" />
            <Linha largura="64%" />
          </div>
          <div className="mt-[18px] h-[92px] rounded bg-tela" />
        </div>
        {/* Duas páginas ocupam 416px, e com o respiro lateral não cabem num
            iPhone. Abaixo de 480px a ilustração vira página única — que é o que
            o leitor de verdade faz na mesma largura (critério 8.3). */}
        <div className="relative hidden h-[288px] w-[208px] bg-superficie-fraca px-5 py-[22px] min-[480px]:block">
          <div className="flex flex-col gap-[7px]">
            <Linha largura="88%" />
            <Linha largura="100%" />
            <Linha largura="74%" />
          </div>
          <div className="mt-4 h-[118px] rounded bg-gradient-to-br from-preenchimento to-hairline" />
          <div className="mt-4 flex flex-col gap-[7px]">
            <Linha largura="96%" />
            <Linha largura="58%" />
          </div>
          <div className="absolute inset-y-0 right-0 w-11 bg-gradient-to-l from-tinta/10 to-transparent" />
        </div>
      </div>
    </div>
  )
}

function Linha({ largura }: { largura: string }) {
  return <div className="h-[5px] rounded-[3px] bg-preenchimento" style={{ width: largura }} />
}
