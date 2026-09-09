// /privacidade — política de privacidade (spec seção 20, critério 8.6).
//
// Diz o que se coleta, por quê e por quanto tempo, e nomeia o controlador. O
// ponto que vale destacar: de quem lê não se coleta nada — sem conta, sem cookie
// de rastreio e sem analytics de terceiro.
import type { Metadata } from 'next'
import { CabecalhoPublico, RodapePublico } from '@/components/marketing/Chrome'
import { RESPONSAVEL, emailDeContato } from '@/lib/copy'
import { Documento, Secao } from '@/components/marketing/Documento'

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'O que o Virapágina coleta, por quê e por quanto tempo.',
}

export default function PrivacidadePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-tela">
      <CabecalhoPublico />
      <Documento titulo="Política de privacidade" atualizadoEm="9 de setembro de 2026">
        <Secao titulo="Quem trata seus dados">
          <p>
            O controlador dos dados é {RESPONSAVEL.nome}, CNPJ {RESPONSAVEL.cnpj}. Para exercer
            qualquer direito descrito aqui, escreva para{' '}
            <a href={`mailto:${emailDeContato()}`}>{emailDeContato()}</a>.
          </p>
        </Secao>

        <Secao titulo="De quem lê, não coletamos nada">
          <p>
            Ler um livro no Virapágina não exige conta, não cria cadastro e não instala cookie de
            rastreio. Não usamos analytics de terceiro. Se você chegou aqui por um link e só quer
            ler, não guardamos nada seu.
          </p>
          <p>
            Medimos apenas quantos bytes servimos por conta de autor, agregado por mês, para saber
            quando uma conta está consumindo muito da nossa infraestrutura. Essa medição não
            distingue leitores nem guarda quem leu o quê.
          </p>
        </Secao>

        <Secao titulo="De quem publica">
          <table>
            <thead>
              <tr>
                <th>Dado</th>
                <th>Por quê</th>
                <th>Por quanto tempo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>E-mail, nome e identificador da conta Google</td>
                <td>Identificar a conta e permitir que você entre</td>
                <td>Enquanto a conta existir</td>
              </tr>
              <tr>
                <td>Endereço público (handle)</td>
                <td>Formar a URL dos seus livros; é público por natureza</td>
                <td>Enquanto a conta existir</td>
              </tr>
              <tr>
                <td>PDFs e capas que você sobe</td>
                <td>São o produto: é o que servimos a quem abre o link</td>
                <td>Enquanto o livro existir</td>
              </tr>
              <tr>
                <td>Bytes servidos por mês</td>
                <td>Saber quando uma conta passa da franquia de tráfego</td>
                <td>Mês corrente</td>
              </tr>
            </tbody>
          </table>
          <p>
            A base legal é a execução do contrato: sem esses dados não há como operar a conta nem
            servir os livros.
          </p>
        </Secao>

        <Secao titulo="Com quem compartilhamos">
          <p>
            Com os provedores de infraestrutura que fazem o serviço funcionar: Google (login,
            banco de dados e armazenamento dos arquivos) e Vercel (hospedagem da aplicação). Não
            vendemos, alugamos nem cedemos dados a terceiros para publicidade.
          </p>
        </Secao>

        <Secao titulo="Seus direitos">
          <p>
            Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento, pelo
            e-mail acima. A exclusão de conta é atendida em até 30 dias e apaga a conta, o
            endereço público, todos os livros e todos os arquivos —{' '}
            <strong>os links publicados deixam de funcionar</strong>.
          </p>
          <p>
            Seus arquivos nunca ficam reféns: enquanto o livro existir, você pode baixar o PDF
            original pela própria página pública dele.
          </p>
        </Secao>
      </Documento>
      <RodapePublico />
    </div>
  )
}
