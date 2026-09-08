// Cliente da Google Drive API v3: guarda e serve os arquivos dos livros — o PDF
// original e a imagem de capa (spec seções 4 e 13). Como no sheets.ts, nada aqui
// roda no navegador: a credencial da conta de serviço só existe no servidor
// (princípio 0.3). O público só chega nos arquivos pelas rotas de proxy.
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { driveFolderId, serviceAccountCredentials } from './config'

// Escopo de leitura e escrita no Drive. Na prática o alcance da conta de serviço
// é só o que foi compartilhado com ela — a pasta do Virapágina (seção 20).
const ESCOPOS_DRIVE = ['https://www.googleapis.com/auth/drive']

// Autenticação JWT da conta de serviço, reaproveitada pelas funções deste módulo.
function getAuth() {
  const credenciais = serviceAccountCredentials()
  return new google.auth.JWT({
    email: credenciais.client_email,
    key: credenciais.private_key,
    scopes: ESCOPOS_DRIVE,
  })
}

// Cliente autenticado da Drive API.
function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuth() })
}

// Abre uma sessão de upload resumável no Drive e devolve a URL temporária dessa
// sessão. O navegador envia os bytes do PDF direto para essa URL, com barra de
// progresso real (critério 8.2), sem que a credencial da conta de serviço saia
// do servidor.
//
// Divergência consciente em relação à letra da seção 4, aprovada pelo Alexandre:
// lá está escrito que os bytes passariam pela rota de API. Funções serverless da
// Vercel aceitam no máximo ~4,5 MB de corpo de requisição, o que tornaria a regra
// 11.2 (PDF de até 100 MB) impossível de cumprir em produção. A sessão resumável
// resolve isso mantendo o princípio de que o segredo nunca vai ao navegador.
//
// O cabeçalho Origin é obrigatório na abertura da sessão: sem ele o Google
// devolve uma URL que o navegador não consegue usar por CORS.
export async function createResumableUploadSession(params: {
  nome: string
  mimeType: string
  tamanhoBytes: number
  origin: string
}): Promise<string> {
  const auth = getAuth()
  const token = await auth.getAccessToken()
  if (!token.token) throw new Error('Não foi possível obter token da conta de serviço')

  const resposta = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
        'X-Upload-Content-Length': String(params.tamanhoBytes),
        Origin: params.origin,
      },
      body: JSON.stringify({ name: params.nome, parents: [driveFolderId()] }),
    },
  )

  if (!resposta.ok) {
    throw new Error(`Falha ao abrir sessão de upload no Drive: ${resposta.status}`)
  }
  const sessionUrl = resposta.headers.get('location')
  if (!sessionUrl) throw new Error('Drive não devolveu a URL da sessão de upload')
  return sessionUrl
}

// Sobe um arquivo pequeno direto pelo servidor. Usado só para a imagem de capa
// gerada no navegador (regra 11.1), que tem alguns KB e cabe folgado no limite
// de corpo de requisição da Vercel.
export async function uploadFile(params: {
  nome: string
  mimeType: string
  conteudo: Buffer
}): Promise<string> {
  const drive = getDriveClient()
  const resposta = await drive.files.create({
    requestBody: { name: params.nome, parents: [driveFolderId()] },
    media: { mimeType: params.mimeType, body: Readable.from(params.conteudo) },
    fields: 'id',
  })
  const id = resposta.data.id
  if (!id) throw new Error('Drive não devolveu o id do arquivo criado')
  return id
}

// Lê os metadados de um arquivo do Drive (tamanho e tipo), usados para preencher
// `arquivo_pdf_tamanho_bytes` e para os cabeçalhos do proxy.
export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient()
  const resposta = await drive.files.get({
    fileId,
    fields: 'id,name,size,mimeType',
  })
  return {
    id: resposta.data.id ?? fileId,
    nome: resposta.data.name ?? '',
    tamanhoBytes: resposta.data.size ? Number(resposta.data.size) : null,
    mimeType: resposta.data.mimeType ?? 'application/octet-stream',
  }
}

// Baixa o conteúdo de um arquivo do Drive como stream, para o proxy das rotas
// /api/livros/[slug]/pdf e /capa transmitir ao navegador (seção 13). O leitor
// nunca recebe um link direto do Drive.
export async function downloadFileStream(fileId: string): Promise<ReadableStream<Uint8Array>> {
  const drive = getDriveClient()
  const resposta = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
  )
  return Readable.toWeb(resposta.data as unknown as Readable) as ReadableStream<Uint8Array>
}

// Apaga um arquivo do Drive (regra 11.6). Nunca lança: a exclusão do livro já
// removeu a linha da planilha, e falhar aqui não pode desfazer aquilo — o arquivo
// órfão é registrado no log de servidor para limpeza manual.
export async function deleteFile(fileId: string): Promise<void> {
  try {
    const drive = getDriveClient()
    await drive.files.delete({ fileId })
  } catch (erro) {
    console.error(`Falha ao apagar arquivo ${fileId} do Drive:`, erro)
  }
}

// Sobe a capa gerada no navegador (regra 11.1). Recebe o PNG em base64 — com ou
// sem o prefixo "data:image/png;base64," — e devolve o id do arquivo no Drive.
// Devolve null se o conteúdo vier vazio: livro sem capa é estado previsto
// (`capa_drive_id` nulo, seção 7) e não pode bloquear o cadastro.
export async function uploadCapaPng(
  nomeBase: string,
  capaBase64: string | null | undefined,
): Promise<string | null> {
  if (!capaBase64) return null
  const semPrefixo = capaBase64.replace(/^data:image\/png;base64,/, '')
  const conteudo = Buffer.from(semPrefixo, 'base64')
  if (conteudo.length === 0) return null
  return uploadFile({
    nome: `${nomeBase}-capa.png`,
    mimeType: 'image/png',
    conteudo,
  })
}
