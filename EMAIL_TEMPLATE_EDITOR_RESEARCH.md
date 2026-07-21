# EMAIL_TEMPLATE_EDITOR_RESEARCH.md — Pesquisa Externa: HTML ⇄ Blocos sem Perda

**Data:** 2026-07-07
**Escopo:** Como o Resend resolve a alternância HTML ⇄ blocos no editor deles; o que o TipTap/ProseMirror garante (e não garante) de round-trip HTML → JSON → HTML; capacidades do `@maily-to/core` e do `@react-email/editor`.
**Método:** documentação oficial do Resend/React Email, docs e fórum do TipTap/ProseMirror, descrições das ferramentas do MCP oficial do Resend (conectado neste workspace), skill `react-email` local (referência `EDITOR.md`). Rodada somente-leitura — nenhum código de produção alterado.
**Documentos irmãos:** `EMAIL_TEMPLATE_EDITOR_AUDIT.md` (causa raiz no código), `EMAIL_TEMPLATE_EDITOR_SPEC.md` (proposta).

---

## 1. Resposta curta

1. **O Resend não resolve o round-trip HTML → blocos. Ele o evita.** No produto do Resend, o formato canônico de um template/broadcast é o **documento TipTap JSON**; o HTML de e-mail é um **artefato compilado, one-way**. A própria documentação do MCP oficial do Resend declara: *"switching from `compose` (JSON) to `html` mode is lossy"* — a transição JSON → HTML é permitida com perda declarada, e **não existe caminho reverso HTML → JSON** no produto deles.
2. **TipTap/ProseMirror descartam silenciosamente tudo que não conforma ao schema.** Round-trip HTML → JSON só é estável para markup que os próprios nodes sabem parsear (`parseHTML`). O HTML de exportação de e-mail (tabelas, scaffold, estilos inline) **não é** esse markup.
3. A garantia de "alternar sem perda" que o estado-alvo pede, portanto, **não pode vir de parsing** — precisa vir de arquitetura de persistência (JSON canônico + snapshot/fingerprint) com **fallback de bloco opaco** para HTML manual. É isso que a spec propõe.

---

## 2. Como o Resend faz (o que foi possível confirmar)

### 2.1 O editor deles é aberto: `@react-email/editor` (TipTap/ProseMirror)

Desde o React Email 6, o editor visual do Resend é publicado como pacote embarcável open-source — exatamente o pacote que este projeto usou na 2ª geração do modo blocos (ver AUDIT §2). Fatos confirmados na documentação oficial ([Embed the React Email editor](https://resend.com/docs/knowledge-base/embed-react-email-editor), [React Email 6.0](https://resend.com/blog/react-email-6), referência local `.claude/skills/react-email/references/EDITOR.md`):

- Construído sobre **TipTap/ProseMirror**, com `StarterKit` de 35+ extensões email-aware (headings, listas, tabelas, colunas, botões, divider, section, imagem...).
- A prop `content` aceita **string HTML ou TipTap JSON** — ou seja, importar HTML é *suportado*, mas passa pelo parse padrão do ProseMirror (com as perdas da §3).
- A exportação é um pipeline **one-way**: `composeReactEmail({ editor })` lê o JSON do editor → percorre cada node/mark → chama `renderToReactEmail()` de cada `EmailNode`/`EmailMark` → aplica o tema (`EmailTheming`, estilos inline) → **envolve em um template base** (doctype, head, body, container) → renderiza HTML + texto puro.
- **Ponto crítico:** as regras `parseHTML()` de cada node casam com o **DOM do editor** (ex.: `div[data-callout]`), **não** com a saída de `renderToReactEmail()` (ex.: tabela estilizada inline). São dois dialetos de HTML distintos por design. Não existe, em nenhum lugar da documentação, um caminho documentado de "HTML de e-mail exportado → de volta para JSON".

### 2.2 Na plataforma do Resend, TipTap JSON é a fonte de verdade

O MCP oficial do Resend (conectado neste workspace) expõe o modelo de conteúdo do produto deles. Da descrição das próprias ferramentas:

- `get-tiptap-json-content`: *"Retrieve the existing TipTap JSON content of a broadcast or template, optionally bundled with the TipTap schema reference... Use the content as the base for modifications, then pass the updated JSON to compose-broadcast or compose-template."* — o conteúdo canônico que a plataforma armazena e edita é **TipTap JSON**.
- `compose-template` é o caminho recomendado de edição (atualiza a representação JSON); `update-template` serve para metadados **ou** para gravar HTML/texto cru — e a documentação da integração ([resend-mcp — Template Tools](https://deepwiki.com/resend/resend-mcp/3.3-template-tools)) avisa: *"switching from `compose` (JSON) to `html` mode is lossy"*.
- `create-template` aceita `html` direto — o que estabelece o template em "modo HTML", **fora** do pipeline do editor visual.

### 2.3 O modelo de produto do Resend para o mesmo dilema

Juntando docs + changelog ([Introducing the New Email Editor](https://resend.com/changelog/introducing-the-new-email-editor), [Using Templates](https://resend.com/docs/dashboard/templates/introduction)):

| Situação | Comportamento do Resend |
|---|---|
| Template criado/editado no editor visual | JSON canônico; HTML sempre compilado a partir dele |
| Inspecionar/editar o HTML de um documento | *Code view panel* (com Prettier) — apresentado como visão de **inspeção** do compilado, destacada para documentos criados via API |
| Sair do modo compose (JSON) para HTML cru | Permitido, **com perda declarada** ("lossy") — a estrutura de blocos é abandonada |
| Voltar de HTML cru para blocos | **Não existe** caminho documentado |
| Importar HTML/React Email para criar template | Suportado na criação, com restrições declaradas (só imports de `@react-email/components` em código React Email colado) |

**Conclusão da Fase 1, item 1:** a referência de paridade (Resend) não implementa alternância bidirecional sem perda. Ela implementa **JSON-first com saída one-way para HTML e perda explícita e comunicada** ao abandonar o modo compose. Qualquer solução nossa que prometa mais do que isso precisa vir de arquitetura própria (ver SPEC, decisão D1), não de imitação do Resend.

### 2.4 O que NÃO foi possível confirmar (reporte explícito)

- **O código interno do dashboard do Resend é fechado.** Não foi possível confirmar se existe alguma heurística interna de importação HTML→blocos além do parse padrão do TipTap (`content` prop). Nenhum blog post, changelog ou repositório público descreve tal mecanismo.
- Não foi encontrada declaração pública do Resend sobre *fingerprint/snapshot* para restaurar blocos após visita ao modo HTML — a proposta da SPEC nesse ponto é derivada da tecnologia (TipTap), não de prática confirmada do Resend.
- O detalhe exato do markup gerado por `renderToReactEmail()` de cada bloco do `StarterKit` não está documentado publicamente e **varia por versão do pacote** — precisa ser levantado por snapshot testing no nosso próprio repo (SPEC, Estágio 1).

---

## 3. O que o TipTap/ProseMirror garante — e não garante

### 3.1 Perda silenciosa é comportamento de design, não bug

- Docs oficiais ([Export to JSON and HTML](https://tiptap.dev/docs/guides/output-json-html)): *"Even if there are some tags or attributes that aren't allowed (based on your configuration), Tiptap just throws them away quietly."*
- Fórum do ProseMirror ([Convert Tiptap JSON to HTML](https://discuss.prosemirror.net/t/convert-tiptap-json-to-html/6347)): *"Content which does not conform to the schema WILL BE LOST. ProseMirror can accept a fair amount of HTML content & parse it into a structured format but it cannot reliably do so with arbitrary HTML."*
- Persistência: TipTap aceita JSON ou HTML como formato de armazenamento (*"Both work fine"*), mas JSON é *"more like what Tiptap uses under the hood"* — e é o único formato que preserva atributos/nodes custom com fidelidade total.

### 3.2 Round-trip só é estável dentro do dialeto do editor

Cada node/mark tem um par `renderHTML()` (JSON → DOM do editor) e `parseHTML()` (DOM → JSON). O ciclo `getHTML()` → `content` é razoavelmente estável **para esse dialeto**. O ciclo que interessa ao nosso caso — **HTML de e-mail exportado** → JSON — não é coberto por esse par, porque:

1. A exportação de e-mail (`composeReactEmail` no react-email; `@maily-to/render` no Maily) produz markup diferente do DOM do editor (tabelas de layout, estilos inline resolvidos pelo tema, scaffold `<html><head>...`).
2. Não existem `parseHTML` rules para esse markup — nem no react-email editor, nem no Maily.
3. Mesmo round-trips do dialeto do editor quebram entre versões: o issue [tiptap#4089](https://github.com/ueberdosis/tiptap/issues/4089) documenta uma extensão *first-party* (YouTube) incapaz de re-parsear o próprio HTML gerado. Regras de parse acopladas a markup gerado são frágeis por natureza — cada bump de versão do pacote de blocos pode mudar o markup silenciosamente.

### 3.3 O padrão de degradação graciosa existe e é suportado

O TipTap suporta nodes custom com atributo de conteúdo cru — o padrão "bloco de HTML customizado" (opaco): um node atômico que armazena o HTML original byte a byte num atributo, renderiza preview no editor e emite o HTML intacto na exportação. No react-email editor isso é diretamente implementável com `EmailNode.create({...})` + `renderToReactEmail()` (API pública documentada na referência do editor). É o mecanismo que garante o requisito "nunca descartar conteúdo não reconhecido" do estado-alvo. Builders comerciais (Unlayer, Beefree, Templatical) usam exatamente esse padrão para HTML arbitrário.

---

## 4. Maily (`@maily-to/core`) — situação específica

- O `@maily-to/core` fornece o `Editor` (TipTap) que trabalha com `JSONContent`; a conversão para HTML de e-mail vive num pacote separado, [`@maily-to/render`](https://www.npmjs.com/package/@maily-to/render) — **one-way** (JSON → HTML). Não existe importação HTML → JSON no Maily ([repositório maily.to](https://github.com/arikchakma/maily.to)).
- **Este projeto nunca instalou `@maily-to/render`**: a 1ª geração do editor salvava só o `mailyJson` no modo visual (sem HTML — templates desse modo nem podiam ser enviados, já que o envio usa `template.html`), e importava HTML com `generateJSON()` genérico do TipTap — com toda a perda da §3.1 (evidências no AUDIT §3).
- O JSON do Maily e o JSON do `@react-email/editor` **não são compatíveis entre si** (schemas/nomes de nodes diferentes). `mailyJson` legado da 1ª geração não abre no editor react-email — relevante para a migração (SPEC, edge cases).

---

## 5. Consolidação — o que a pesquisa estabelece para a Fase 3

| Pergunta da hipótese do time | Resposta da pesquisa |
|---|---|
| `parseHTML` rules casando com o markup de exportação bastam para round-trip sem perda dentro do padrão? | **Só em teoria e de forma frágil.** Exigiria regras para o markup de *e-mail* de cada bloco + desembrulhar o scaffold do documento; o markup muda por versão do pacote (precedente: tiptap#4089); o próprio Resend não faz isso e declara a transição como lossy. Serve como *best-effort*, não como garantia. |
| O que acontece com HTML manual fora do padrão? | No TipTap puro: **descartado silenciosamente** (design). Solução obrigatória: bloco opaco de "HTML customizado" (padrão da indústria, suportado via `EmailNode`). |
| Existe caminho para round-trip 100% sem perda dos blocos suportados? | **Sim, mas não via parsing:** JSON permanece armazenado como snapshot ao entrar no modo HTML + fingerprint do HTML compilado; se o HTML não foi tocado, voltar a blocos restaura o snapshot — perda zero por definição, para qualquer bloco, independente de versão. É a base da decisão D1 da SPEC. |

## 6. Fontes

- [Resend — Embed the React Email editor](https://resend.com/docs/knowledge-base/embed-react-email-editor)
- [Resend — React Email 6.0](https://resend.com/blog/react-email-6) · [Changelog: Introducing the New Email Editor](https://resend.com/changelog/introducing-the-new-email-editor) · [Docs: Using Templates](https://resend.com/docs/dashboard/templates/introduction)
- [resend-mcp — Template Tools (DeepWiki)](https://deepwiki.com/resend/resend-mcp/3.3-template-tools) — fonte da citação "switching from compose (JSON) to html mode is lossy"; descrições das tools `get-tiptap-json-content`/`compose-template` confirmadas no MCP conectado neste workspace
- [TipTap — Export to JSON and HTML](https://tiptap.dev/docs/guides/output-json-html) · [TipTap — HTML utility (generateJSON/generateHTML)](https://tiptap.dev/docs/editor/api/utilities/html) · [tiptap#4089 — extensão não re-parseia o próprio HTML](https://github.com/ueberdosis/tiptap/issues/4089)
- [ProseMirror discuss — Convert Tiptap JSON to HTML](https://discuss.prosemirror.net/t/convert-tiptap-json-to-html/6347)
- [@maily-to/render (npm)](https://www.npmjs.com/package/@maily-to/render) · [@maily-to/core (npm)](https://www.npmjs.com/package/@maily-to/core) · [maily.to (GitHub)](https://github.com/arikchakma/maily.to)
- Referência local: `.claude/skills/react-email/references/EDITOR.md` (arquitetura do `@react-email/editor`, `composeReactEmail`, `EmailNode`)
