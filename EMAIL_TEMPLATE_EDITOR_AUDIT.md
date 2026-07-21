# EMAIL_TEMPLATE_EDITOR_AUDIT.md — Por que alternar HTML ⇄ Blocos quebra o template

**Data:** 2026-07-07
**Escopo:** editor de template de e-mail (`app/[supabaseId]/email/templates/[id]/`), persistência (`EmailTemplateUseCase`, schema `EmailTemplate`), histórico git das duas gerações do modo blocos.
**Método:** leitura do código atual + arqueologia git (código removido recuperado de `a2c04017^`/`ba073021` e `c392fac8^`). Rodada somente-leitura — nenhum código de produção alterado.
**Documentos irmãos:** `EMAIL_TEMPLATE_EDITOR_RESEARCH.md` (pesquisa externa), `EMAIL_TEMPLATE_EDITOR_SPEC.md` (proposta).

---

## 1. Sumário executivo

1. **O modo blocos existiu ponta a ponta, em duas gerações, e foi removido — não está "desabilitado esperando conserto".** Geração 1: `MailyEditor` (`@maily-to/core`, removido em `a2c04017`). Geração 2: `@react-email/editor` v1.1.2 (o editor do próprio Resend), com switch de modo + `EditorModeSwitchDialog`, removido em `c392fac8` (2026-06-30). Hoje `resolveEditorMode()` retorna `"html"` incondicionalmente e o tipo `EditorMode = "html"` não admite outro valor.
2. **A quebra tinha três causas raiz simultâneas** (detalhadas na §3): (i) **divergência dos campos `html` × `mailyJson`** — salvar em modo HTML persistia o `mailyJson` velho, e a carga do editor preferia o `mailyJson`, fazendo edições HTML "sumirem"; (ii) **importação HTML→blocos via parse do TipTap**, que descarta silenciosamente toda estrutura fora do schema (tabelas de layout, `<style>`, `<head>` — ou seja, e-mail HTML real); (iii) **destruição do JSON bom a cada troca** (`clearMailyJson: true`), degradando até round-trips sem nenhuma edição.
3. **A hipótese "os dois campos divergem e a troca lê o campo desatualizado" está confirmada no código** — é a causa (i), com o agravante de que o *default* do estado do editor era `"blocks"`, então a leitura do campo errado acontecia já no reload da página, não só na troca manual.
4. **Sintoma observável:** perda e sobrescrita de conteúdo (não crash, não duplicação). Perda imediata e visível ao entrar em blocos com HTML real (import lossy); perda retroativa e silenciosa ao republicar a partir de blocos alimentados por JSON velho.
5. **Bug residual ativo hoje (sem switch nenhum):** templates legados com `mailyJson` não-nulo **não podem ser salvos** — o frontend sempre envia `mailyJson` no payload e o backend rejeita `mailyJson` não-nulo em modo HTML. Ver §5.

---

## 2. Linha do tempo (arqueologia git)

| Quando | Commit | O que existia |
|---|---|---|
| ~05/2026 | `f919e2d0` → `ba073021` | **Geração 1 — Maily**: `MailyEditor.tsx` (`@maily-to/core`), `HtmlEditor.tsx`, modo inferido por presença de dados (`data.mailyJson ? 'maily' : 'html'`), import de HTML via `utils/importHtml.ts` (`generateJSON` + DOMPurify) |
| `a2c04017` | "refactor: remove unused emailPageStyle..." | MailyEditor removido; nasce a **Geração 2** com `@react-email/editor` v1.1.2 (editor embarcável do Resend): `EmailEditorStudio` com `ToggleGroup` de modo, `EditorModeSwitchDialog` (AlertDialog avisando de possível perda), export via `composeReactEmail` |
| 2026-06-29 | migrations `20260629201446` + `20260629201511` | Coluna `editorMode` criada (default `'blocks'`) e backfill `'html'` para templates sem `mailyJson` |
| 2026-06-30 | `c392fac8` | **Modo blocos removido**: dep `@react-email/editor` desinstalada, `EditorModeSwitchDialog`/`EditorBlocksPanel` deletados, `resolveEditorMode()` passa a retornar `"html"` fixo, `setMailyJson` removido do hook |
| 2026-07-06 | migration `20260706185148` | Default de `editorMode` alterado para `'html'` (Estágio 7 da `EMAIL_SPEC.md`) |
| Hoje | branch atual | Editor 100% HTML (Monaco + preview). `@maily-to/core` ^0.3.7 segue **órfão** no `package.json` (nenhum import em `app/`/`lib`); a landing ainda anuncia "Editor visual drag-and-drop (Maily)" (`lib/landing/features-data.ts:42`) |

Resposta direta à pergunta da Fase 2 ("existe modo blocos desabilitado, ou nunca funcionou?"): **funcionou ponta a ponta e foi removido por quebrar**. O aviso do próprio `EditorModeSwitchDialog` admitia a perda: *"estruturas ou estilos complexos podem não ser preservados exatamente"* / *"podem ser simplificados durante a importação"*.

---

## 3. Causa raiz — as três quebras, com evidência

Evidência recuperada de `git show c392fac8^` (última versão funcional do switch, Geração 2) e `ba073021` (Geração 1). Caminhos abaixo referem-se a esses snapshots; cópias em `scratchpad` foram usadas para leitura.

### 3.1 🔴 Divergência `html` × `mailyJson` — salvar em HTML preservava o JSON velho, e a carga preferia o JSON

`EmailEditorStudio.tsx` (Geração 2, em `c392fac8^`):

```tsx
// snapshot do modo HTML — carrega o mailyJson ANTIGO junto do html novo
const buildHtmlModeSnapshot = useCallback((): EditorSnapshot => {
  const html = htmlModeValue || draft.html;
  return {
    html,
    mailyJson: draft.mailyJson,   // ← JSON de antes das edições em HTML
    previewText: draft.previewText,
  };
}, [...]);
```

```tsx
// carga do editor visual — prefere o mailyJson quando existe
const editorContent = useMemo(() => {
  if (draft.mailyJson && !isEditorJsonEmpty(draft.mailyJson)) {
    return draft.mailyJson;      // ← campo desatualizado vence
  }
  if (draft.html.trim()) {
    return draft.html;
  }
  return undefined;
}, [draft.mailyJson, draft.html]);
```

```tsx
const [editorMode, setEditorMode] = useState<EditorMode>("blocks"); // ← default blocos
```

**Cadeia da perda:** usuário edita em modo HTML → salva (`html` novo + `mailyJson` velho persistidos juntos) → recarrega a página → editor abre em `"blocks"` (default do estado, ignorando o que foi editado por último) → `editorContent` prefere o `mailyJson` velho → usuário vê o conteúdo antigo → qualquer publicação a partir dali (`syncEditorDraft` → `composeReactEmail`) **regenera o `html` a partir do JSON velho e sobrescreve as edições salvas**. Era exatamente a hipótese do prompt: dois campos divergem e a troca lê o desatualizado. A coluna `editorMode` só foi criada **um dia antes** da remoção do modo blocos e nunca foi usada como árbitro de qual campo é o mais recente (`resolveEditorMode` da época não existia; o do dia seguinte já retornava `"html"` fixo).

Na Geração 1 a mesma divergência existia com outro formato: `TemplateEditorHook.ts` (`ba073021`) linha 106 salvava `html: mode === 'html' ? html || undefined : undefined` — **em modo visual o `html` não era gravado** (e como o envio usa exclusivamente `template.html`, template criado no modo visual da Geração 1 nem podia ser disparado); linha 75 inferia o modo por `data.mailyJson ? 'maily' : 'html'`.

### 3.2 🔴 Importação HTML → blocos via parse do TipTap — perda estrutural silenciosa por design

Geração 1, `features/utils/importHtml.ts` (`ba073021`):

```ts
export function applyHtmlToEditor(editor: TiptapEditor, rawHtml: string): void {
  const sanitized = sanitizeImportedHtml(rawHtml)      // DOMPurify: permite table/td/tr...
  const extensions = editor.extensionManager.extensions
  const json = generateJSON(sanitized, extensions)     // ← TipTap descarta o que o schema não conhece
  editor.chain().focus().setContent(json, true).run()
}
```

O DOMPurify *permitia* `table/tbody/tr/td` no HTML sanitizado — mas o schema do Maily **não tem nodes de tabela de layout**, então o `generateJSON` colapsava toda a estrutura tabular (que é como e-mail HTML real é construído) em texto solto, e descartava `<style>`, `<head>`, atributos não mapeados. Comportamento documentado do TipTap/ProseMirror: conteúdo fora do schema é jogado fora *silenciosamente* (RESEARCH §3.1).

Geração 2 tinha o mesmo problema por outro caminho: `applyModeSwitch` entregava o HTML cru à prop `content` do `EmailEditor`, que faz o mesmo parse interno. Pior: o HTML que o próprio editor exporta (`composeReactEmail`) é envolvido em scaffold (doctype, head, container, tabelas, estilos de tema inline) **para o qual não existem `parseHTML` rules** — ou seja, nem o HTML gerado pelo próprio modo blocos sobrevivia à reimportação (RESEARCH §2.1, §3.2).

### 3.3 🟡 `clearMailyJson: true` — a troca destruía o JSON bom mesmo sem edição

`applyModeSwitch` (Geração 2, `c392fac8^`):

```tsx
const htmlToImport = htmlModeValue || draft.html;
mergeHtmlDraft(htmlToImport, { clearMailyJson: true });  // ← zera o JSON estruturado
setVisualContentRevision((current) => current + 1);       // remonta o editor a partir do HTML
setEditorMode("blocks");
```

Ao voltar para blocos, o JSON estruturado era **sempre** descartado e reconstruído a partir do HTML — mesmo quando o usuário não tinha tocado em nada no modo HTML. Resultado: cada ida-e-volta blocos → HTML → blocos degradava o documento para "o que sobrevive ao parse" (§3.2), sem necessidade. Não havia fingerprint/comparação para detectar "HTML não foi alterado, restaure o JSON original".

### 3.4 Agravantes menores

- `visualEditorTouched` como heurística: blocos → HTML só sincronizava o HTML se o editor visual tivesse disparado `onUpdate`; estados intermediários (editor montado mas não tocado) dependiam de `draft.html` estar coerente — mais um ponto em que os dois campos podiam dessincronizar.
- `restoreVersion` (ainda hoje, `EmailTemplateUseCase.ts:946-948`): restaurar uma versão recupera `html: version.html` mas mantém `mailyJson: current.mailyJson` e `editorMode: current.editorMode` — recria a divergência §3.1 por construção. Inócuo enquanto o modo blocos não existe; letal se ele voltar sem correção.

---

## 4. Estado atual do schema e da persistência

`prisma/schema.prisma` (modelo `EmailTemplate`, linhas 2145-2147):

```prisma
mailyJson   Json?
html        String?  @db.Text
editorMode  String   @default("html") @db.Text   // "blocks" | "html" (zod em templates/route.ts:42)
```

- **Envio usa exclusivamente `template.html`** (cron e UseCase — já auditado em `EMAIL_AUDIT.md` §3.6); `mailyJson` é ignorado no envio.
- **Não há como saber qual campo é o mais recente.** `editorMode` funciona como proxy de "último modo de autoria" desde as migrations de 29/06, mas: (i) não há timestamp/fingerprint associado; (ii) o histórico anterior a 29/06 foi backfillado por inferência (`html` presente + `mailyJson` vazio ⇒ `'html'`); (iii) nada impede — hoje via allowlist, no futuro via bug — uma escrita que atualize um campo sem o outro. Este é o gap (b) do prompt; a resolução proposta (invariantes por modo + fingerprint) está na SPEC, decisão D1/D3.
- Backend já reforça meia-invariante (Estágio 7 da `EMAIL_SPEC.md`): criação com `editorMode === "html"` zera `mailyJson` (`EmailTemplateUseCase.ts:290-293`) e update rejeita `mailyJson` não-nulo em modo HTML (`:353-365`). **Não existe a invariante espelho para o modo blocos** (salvar blocos exigiria `html` compilado junto) — porque o modo blocos não existe na UI.

## 5. 🐛 Bug residual ativo: template legado com `mailyJson` não pode ser salvo

O frontend envia `mailyJson` **sempre** no payload de save:

```ts
// app/[supabaseId]/email/templates/[id]/features/services/TemplateEditorService.ts:287-296
private toPayload(draft: TemplateEditorDraft) {
  return {
    ...
    mailyJson: draft.mailyJson,   // ← draft carrega o mailyJson legado do template
    editorMode: draft.editorMode, // ← sempre "html" (resolveEditorMode fixo)
    ...
  };
}
```

E o backend rejeita (`app/api/useCases/email/EmailTemplateUseCase.ts:353-365`):

```ts
const resolvedEditorMode = data.editorMode ?? existing.editorMode ?? "html"
if (resolvedEditorMode === "html" && data.mailyJson !== undefined && data.mailyJson !== null) {
  return new Output(false, [], ["Templates em modo HTML não aceitam conteúdo de blocos (mailyJson)"], null)
}
```

**Cenário de falha concreto:** abrir qualquer template criado na era do modo blocos (com `mailyJson` não-nulo no banco — `createDraftFromTemplate` copia `template.mailyJson` para o draft, `TemplateEditorHook.ts:57`) e clicar em salvar ⇒ toast "Templates em modo HTML não aceitam conteúdo de blocos (mailyJson)". O template fica **ineditável até o usuário perceber que precisaria... de nada, pois não há workaround na UI**. Correção trivial (não enviar `mailyJson` em modo HTML, ou backend tratar como "preserve/limpe" em vez de rejeitar) — incorporada ao Estágio 2 da SPEC.

## 6. Inventário de blocos (o que "round-trip por tipo de bloco" precisa cobrir)

Hoje: **nenhum bloco ativo** (modo removido). O baseline da Geração 2 — que a SPEC propõe reintroduzir — é o `StarterKit` do `@react-email/editor` com os slash commands padrão: `TEXT`, `H1`–`H3`, `BULLET_LIST`, `NUMBERED_LIST`, `QUOTE`, `CODE`, `BUTTON`, `DIVIDER`, `SECTION`, `TWO/THREE/FOUR_COLUMNS`, imagem (upload/paste) — mais marks (bold, italic, underline, strike, code, link) e, no nosso caso, a extensão de variáveis `{{...}}` (a Geração 1 usava `VariableExtension` do Maily; a Geração 2 descobria variáveis por regex no HTML salvo — `discoverTemplateVariables` em `c392fac8^`).

O **HTML exato de exportação por bloco não é estático** (depende da versão do pacote e do tema `EmailTheming`): a dependência foi removida do projeto, então esse levantamento não pode ser feito nesta rodada por inspeção — a SPEC o transforma em fixtures de snapshot geradas por teste no Estágio 1, que passam a ser o contrato versionado do markup por bloco.

## 7. Consolidação

| # | Achado | Classe | Onde |
|---|---|---|---|
| 1 | Salvar em modo HTML persistia `mailyJson` velho; carga preferia `mailyJson`; default `"blocks"` | 🔴 causa raiz (divergência de fonte de verdade) | `EmailEditorStudio.tsx` em `c392fac8^` (`buildHtmlModeSnapshot`, `editorContent`, `useState("blocks")`) |
| 2 | Import HTML→blocos por parse TipTap descarta estrutura fora do schema; HTML exportado não tem parse rules | 🔴 causa raiz (perda estrutural) | `importHtml.ts` em `ba073021`; prop `content` em `c392fac8^` |
| 3 | Troca html→blocos zerava o JSON bom (`clearMailyJson: true`) sem checar se o HTML mudou | 🟡 agravante (degradação desnecessária) | `applyModeSwitch` em `c392fac8^` |
| 4 | Schema não sabe qual campo é o mais recente (sem fingerprint/timestamp; `editorMode` é proxy fraco) | 🟡 gap estrutural (pergunta (b) do prompt) | `prisma/schema.prisma:2145-2147` |
| 5 | Template legado com `mailyJson` não salva (payload sempre envia `mailyJson`; backend rejeita) | 🐛 bug ativo hoje | `TemplateEditorService.ts:293` + `EmailTemplateUseCase.ts:353-365` |
| 6 | `restoreVersion` restaura `html` mantendo `mailyJson`/`editorMode` atuais — recria a divergência | 🟡 latente | `EmailTemplateUseCase.ts:946-948` |
| 7 | `@maily-to/core` órfão no package.json; landing anuncia editor visual que não existe | 🧹 higiene | `package.json:89`, `lib/landing/features-data.ts:42` |
