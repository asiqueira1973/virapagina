// /termos — termos de uso (spec seção 20, critério 8.6).
//
// Três coisas que a seção 20 exige e que estão aqui com todas as letras: o autor
// declara ter direito sobre o que publica; a plataforma pode despublicar o que
// violar os termos ou a lei; e existe um canal de denúncia com contato. A
// exclusão de conta também está descrita como ela realmente funciona — em até 30
// dias, e os links param de funcionar (decisão 25.2).
import type { Metadata } from 'next'
import { CabecalhoPublico, RodapePublico } from '@/components/marketing/Chrome'
import { RESPONSAVEL, emailDeContato } from '@/lib/copy'
import { Documento, Secao } from '@/components/marketing/Documento'

export const metadata: Metadata = {
  title: 'Termos de uso',
  description: 'As regras de quem publica no Virapágina.',
}

export default function TermosPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-tela">
      <CabecalhoPublico />
      <Documento titulo="Termos de uso" atualizadoEm="9 de setembro de 2026">
        <Secao titulo="Quem opera o Virapágina">
          <p>
            O Virapágina é operado por {RESPONSAVEL.nome}, CNPJ {RESPONSAVEL.cnpj}. Para qualquer
            assunto tratado nestes termos, o contato é{' '}
            <a href={`mailto:${emailDeContato()}`}>{emailDeContato()}</a>.
          </p>
        </Secao>

        <Secao titulo="O que o serviço faz">
          <p>
            Você sobe arquivos PDF e recebe um endereço público onde qualquer pessoa pode ler
            esses arquivos no navegador, folheando as páginas. Quem lê não precisa de conta.
          </p>
          <p>
            O plano gratuito permite até 5 livros por conta. Chegar ao limite impede publicar um
            livro novo — <strong>nunca</strong> tira do ar, despublica ou apaga o que já está
            publicado.
          </p>
        </Secao>

        <Secao titulo="O conteúdo é seu, e a responsabilidade também">
          <p>
            Ao publicar um arquivo, você declara que tem os direitos necessários sobre ele: que é
            o autor, ou que tem autorização de quem é. Você continua sendo o dono do que publica —
            nós apenas hospedamos e servimos.
          </p>
          <p>
            Você é responsável pelo conteúdo que publica, inclusive perante terceiros. Não use o
            Virapágina para publicar material que você não pode publicar.
          </p>
        </Secao>

        <Secao titulo="O que podemos remover">
          <p>
            Podemos despublicar qualquer livro que viole estes termos ou a lei, com ou sem
            denúncia prévia. Despublicar tira o livro do ar e faz o link parar de funcionar;{' '}
            <strong>não apagamos o seu arquivo</strong>, porque uma remoção indevida precisa poder
            ser desfeita.
          </p>
          <p>
            Não fazemos moderação prévia nem varredura automática do que é publicado: agimos
            quando somos avisados.
          </p>
        </Secao>

        <Secao titulo="Denunciar um conteúdo">
          <p>
            Se um livro publicado aqui viola seus direitos ou a lei, escreva para{' '}
            <a href={`mailto:${emailDeContato()}`}>{emailDeContato()}</a> com o endereço do livro e
            o motivo. Respondemos toda denúncia.
          </p>
        </Secao>

        <Secao titulo="Encerrar sua conta">
          <p>
            Para apagar sua conta, escreva para{' '}
            <a href={`mailto:${emailDeContato()}`}>{emailDeContato()}</a>. Atendemos o pedido em
            até 30 dias, apagando a conta, o endereço público, todos os livros e todos os
            arquivos.
          </p>
          <p>
            <strong>
              Os links dos seus livros deixam de funcionar quando a conta é apagada.
            </strong>{' '}
            Se eles circulam por aí, considere isso antes de pedir a exclusão — a remoção é real,
            não um esconder.
          </p>
        </Secao>

        <Secao titulo="Disponibilidade e mudanças">
          <p>
            O Virapágina é oferecido como está, sem garantia de disponibilidade ininterrupta.
            Podemos mudar ou encerrar o serviço; se isso acontecer, avisamos com antecedência
            razoável para você baixar seus arquivos — que, de todo modo, continuam disponíveis
            para download pela página pública de cada livro enquanto ele existir.
          </p>
          <p>
            Se mudarmos estes termos, a data no topo desta página muda junto.
          </p>
        </Secao>
      </Documento>
      <RodapePublico />
    </div>
  )
}
