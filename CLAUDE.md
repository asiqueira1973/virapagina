# CLAUDE.md — Virapágina

Instruções para quem for mexer neste repositório, humano ou agente.

Leia o `spec.md` antes de mudar comportamento e o `prompt-design-virapagina.md`
antes de mudar interface. Este arquivo não os substitui — ele diz como o
repositório está montado e o que quebra se você não souber.

O `DOCUMENTACAO-TECNICA.md` descreve o que **está** implementado, incluindo a
lista de divergências em relação ao spec. Se for mudar schema, rota ou lógica de
tela, atualize-o **no mesmo commit**.

---

## O que é

Plataforma própria de flipbooks: PDFs que o leitor folheia no navegador, com URL
por publicação (`/l/<slug>`) e um painel para o Alexandre subir títulos novos.
Substitui o Heyzine.

**Não há banco de dados.** Os metadados vivem numa planilha do Google Sheets e os
arquivos numa pasta do Google Drive, ambos na conta do Alexandre.

---

## As três pegadinhas que não podem ser quebradas

1. **A renderização do PDF é sempre no navegador** (princípio 0.1). O servidor
   nunca converte o PDF em imagem. O PDF enviado é a fonte única — o que a pessoa
   lê é literalmente o mesmo arquivo que ela baixa. Não introduza um pipeline de
   conversão no servidor sem antes mudar a seção 4 do spec.

2. **Nenhuma chamada ao Sheets ou ao Drive acontece no navegador** (princípio 0.3
   e seção 6). Sempre em rota de servidor ou componente de servidor. A credencial
   da conta de serviço é o segredo mais sensível do projeto: dá escrita na
   planilha e na pasta inteira.

3. **Toda rota sob `/api/admin/*` chama `requireAdmin()` como primeira linha**,
   antes de qualquer leitura ou escrita no Google. Sem banco relacional não existe
   RLS como segunda camada: essa linha é a única coisa entre um estranho e os
   rascunhos. Há teste automatizado que falha se qualquer rota admin tocar no
   Sheets ou no Drive antes de autorizar — **não desative esse teste**.

---

## Comandos

```bash
npm run dev        # servidor local (copia o worker do PDF.js antes)
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest — 44 testes, o portão de qualidade do repositório
```

Build sem warning nosso é critério de aceite. Há um aviso conhecido vindo de
`node_modules/jose` (dependência do Auth.js) sobre `CompressionStream` no Edge
Runtime: é falso positivo da análise do Next, não vem de código nosso, e está
registrado nas divergências do `DOCUMENTACAO-TECNICA.md`.

---

## Onde as coisas moram

```
app/
  (public)/page.tsx            → catálogo
  (public)/l/[slug]/           → leitor público (+ not-found.tsx)
  admin/login/                 → login com Google
  admin/livros/                → lista, novo, [id] (layout com menu lateral)
  api/livros/…                 → rotas públicas: lista, metadados, proxy de PDF e capa
  api/admin/livros/…           → rotas de escrita, todas com requireAdmin()
  api/auth/[...nextauth]/      → callbacks do Auth.js
components/
  reader/                      → BookReader, FlipbookToolbar, PdfPage, ZoomControls
  admin/                       → formulários, lista, diálogos
hooks/useBookUpload.ts         → upload do PDF com progresso real
lib/
  google/config.ts             → variáveis de ambiente e a allowlist
  google/sheets.ts             → ÚNICO arquivo que conhece o formato da planilha
  google/drive.ts              → upload, download e exclusão de arquivo
  google/auth.ts               → Auth.js + requireAdmin() + isAdminRequest()
  pdf/render.ts                → PDF.js: desenhar página e gerar capa
  copy.ts                      → toda a copy da interface (seção 14–15 do spec)
  books.ts, slug.ts, format.ts → regras puras e formatação
types/livro.ts                 → espelho da planilha, campos em português
tests/                         → seção 22: guarda de admin e visibilidade de rascunho
```

**Se um dia a planilha virar um banco de verdade** (roadmap, seção 28), é
`lib/google/sheets.ts` que muda. Nenhum outro arquivo sabe que existe planilha —
mantenha assim.

---

## Idioma e comentários

- **Dados em português, `snake_case`:** colunas da planilha e os tipos TypeScript
  que as espelham (`titulo`, `publicado`, `criado_em`). É o que o Alexandre vê na
  planilha.
- **Código em inglês:** componentes, hooks, funções e nomes de arquivo
  (`BookReader.tsx`, `useBookUpload.ts`).
- **Interface e comentários em português.**
- **Zero string literal de interface nos componentes** — a copy vive em
  `lib/copy.ts`, com os textos exatos da seção 14–15 do spec.
- **Toda função, hook e rota de servidor leva cabeçalho em português** dizendo o
  que faz e **qual regra do spec implementa, com o número** — por exemplo
  `// Gera o slug a partir do título — regra 11.3`. Comentário que repete a
  sintaxe é ruído; o que nomeia a regra é o que salva o projeto daqui a seis
  meses.

---

## Cinco coisas que quebram em silêncio

Cada uma destas já mordeu durante a implementação. Nenhuma dá erro de compilação.

1. **A planilha é posicional.** Uma célula a mais ou a menos numa gravação
   desloca todos os campos da linha e ninguém percebe. `livroToRow` confere a
   contagem contra a lista de colunas e lança erro — não remova essa checagem.

2. **`atualizado_em` não tem trigger.** Não existe banco, logo não existe trigger.
   É a rota de API que reescreve o campo. Uma escrita nova que esqueça disso deixa
   a data velha para sempre.

3. **O PDF.js recusa dois desenhos no mesmo canvas** e só o libera quando o
   anterior termina — cancelar não basta, é preciso esperar. `PdfPage` enfileira
   os desenhos por página. Simplificar isso deixa páginas em branco quando o zoom
   muda rápido.

4. **Medir o container só na montagem não funciona.** Numa aba aberta em segundo
   plano o Chrome zera o layout, e o leitor ficaria em branco para sempre — cenário
   comum quando o link chega pelo LinkedIn e a pessoa abre em nova aba. Por isso o
   `BookReader` usa `ResizeObserver`.

5. **A Sheets API não apaga "a linha do id X".** É preciso localizar o índice e
   pedir um `deleteDimension` por posição. Ver `deleteBookRow`.

---

## O que NÃO implementar

Está no roadmap (spec seção 28) e ficou de fora do v1 de propósito. Nem "só a
estrutura", nem "deixando preparado", nem um campo "para depois":

múltiplos administradores com tela de gestão · analytics de leitura · multi-tenant
/ white-label · migração para banco relacional · grade de miniaturas de página ·
capa customizável à mão · atalhos fixos de WhatsApp/LinkedIn/X · som de virar
página.

Se algo do roadmap parecer necessário para o v1 funcionar, isso é uma pergunta
para o Alexandre, não uma decisão de implementação.
