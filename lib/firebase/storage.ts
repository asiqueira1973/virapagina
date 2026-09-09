// Todo o acesso ao Cloud Storage (spec seções 4 e 13): onde os PDFs e as capas
// ficam, como o navegador os envia e como o público os recebe.
//
// O leitor nunca recebe uma URL do Storage. É isso que permite tirar um livro do
// ar de verdade, que impede um link vazado de sobreviver ao despublicar, e que
// torna possível medir o tráfego por conta (regra 11.11).
import { Readable } from 'node:stream'
import { bucket } from './admin'

// Caminho do PDF original de um livro. Um livro, uma pasta — assim apagar o
// livro é apagar a pasta, e não caçar arquivo solto.
export function caminhoDoPdf(donoId: string, livroId: string): string {
  return `livros/${donoId}/${livroId}/original.pdf`
}

// Caminho da capa gerada da primeira página (regra 11.1).
export function caminhoDaCapa(donoId: string, livroId: string): string {
  return `livros/${donoId}/${livroId}/capa.png`
}

// Abre uma sessão de upload resumável e devolve a URL temporária dela, para o
// navegador enviar os bytes direto ao Google com barra de progresso real
// (critério 8.2).
//
// Por que não passar os bytes pela nossa rota, como seria mais simples: funções
// serverless da Vercel aceitam ~4,5 MB de corpo de requisição, o que tornaria a
// regra 11.2 (PDF de até 100 MB) impossível de cumprir em produção. A credencial
// da conta de serviço continua sem sair do servidor — o navegador recebe apenas
// uma URL válida para aquele upload.
//
// O `origin` é obrigatório: sem ele o Google devolve uma URL que o navegador não
// consegue usar por CORS. O bucket também precisa de configuração de CORS, e o
// passo está no README.
export async function criarSessaoDeUpload(params: {
  caminho: string
  mimeType: string
  origin: string
}): Promise<string> {
  const arquivo = bucket().file(params.caminho)
  const [uri] = await arquivo.createResumableUpload({
    origin: params.origin,
    metadata: { contentType: params.mimeType },
  })
  if (!uri) throw new Error('Storage não devolveu a URL da sessão de upload')
  return uri
}

// Sobe a capa gerada no navegador (regra 11.1). Recebe o PNG em base64 — com ou
// sem o prefixo `data:` — e é enviada pela nossa rota mesmo, porque a capa tem
// algumas centenas de KB e cabe folgado no limite de corpo da Vercel.
//
// Devolve false se o conteúdo vier vazio: livro sem capa é estado previsto
// (`capa_caminho` nulo, seção 7) e não pode bloquear o cadastro.
export async function enviarCapaPng(
  caminho: string,
  capaBase64: string | null | undefined,
): Promise<boolean> {
  if (!capaBase64) return false
  const semPrefixo = capaBase64.replace(/^data:image\/png;base64,/, '')
  const conteudo = Buffer.from(semPrefixo, 'base64')
  if (conteudo.length === 0) return false
  await bucket().file(caminho).save(conteudo, {
    contentType: 'image/png',
    resumable: false,
  })
  return true
}

// Lê um arquivo do Storage para o proxy transmitir ao navegador, junto do
// tamanho — que a rota usa para contabilizar o tráfego da conta (regra 11.11).
export async function baixarArquivo(caminho: string): Promise<{
  stream: ReadableStream<Uint8Array>
  tamanhoBytes: number | null
  mimeType: string
} | null> {
  const arquivo = bucket().file(caminho)
  const [existe] = await arquivo.exists()
  if (!existe) return null

  const [metadados] = await arquivo.getMetadata()
  const stream = Readable.toWeb(
    arquivo.createReadStream() as unknown as Readable,
  ) as ReadableStream<Uint8Array>

  return {
    stream,
    tamanhoBytes: metadados.size ? Number(metadados.size) : null,
    mimeType: metadados.contentType ?? 'application/octet-stream',
  }
}

// Apaga um arquivo. Nunca lança: a exclusão do livro já removeu o documento, e
// falhar aqui não pode desfazer aquilo — o arquivo órfão vira log para limpeza
// manual (regra 11.6).
export async function apagarArquivo(caminho: string): Promise<void> {
  try {
    await bucket().file(caminho).delete({ ignoreNotFound: true })
  } catch (erro) {
    console.error(`Falha ao apagar ${caminho} do Storage:`, erro)
  }
}

// Apaga a pasta inteira de um livro — PDF, capa e qualquer sobra. Usada na
// exclusão, sempre DEPOIS de o documento sair do Firestore (regra 11.6).
export async function apagarPastaDoLivro(donoId: string, livroId: string): Promise<void> {
  try {
    await bucket().deleteFiles({ prefix: `livros/${donoId}/${livroId}/`, force: true })
  } catch (erro) {
    console.error(`Falha ao apagar a pasta do livro ${livroId} no Storage:`, erro)
  }
}
