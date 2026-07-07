# EMAIL_TEMPLATE_EDITOR_SPEC.md — Editor de Template: Modo Blocos + HTML sem Perda

**Data:** 2026-07-07
**Base:** `EMAIL_TEMPLATE_EDITOR_AUDIT.md` (causa raiz) e `EMAIL_TEMPLATE_EDITOR_RESEARCH.md` (pesquisa Resend/TipTap) — seções citadas como AUDIT §x / RESEARCH §x.
**Status:** proposta — aguarda decisões D2 (engine) e confirmação de D1 antes do Estágio 2.
**Relação com specs existentes:** substitui o antigo plano de "6 estágios de paridade visual com o Resend" como frente do editor; não conflita com `EMAIL_SPEC.md` (créditos/dispatch) — o Estágio 7 de lá (D6, editor HTML-only) permanece válido como estado *intermediário* até esta spec ser implementada.

---

## Background

O editor de template hoje é HTML-only (Monaco + preview). O modo blocos existiu em duas gerações (Maily e `@react-email/editor`) e foi removido em 2026-06-30 porque alternar de modo quebrava o template. A auditoria confirmou três causas raiz: divergência `html` × `mailyJson` com leitura do campo desatualizado, importação HTML→blocos via parse TipTap (perda silenciosa por design) e destruição do JSON estruturado a cada troca (AUDIT §3). A pesquisa confirmou que o Resend — referência de paridade — **não faz** round-trip HTML→blocos: JSON é canônico, HTML é compilado one-way e a saída do modo compose é declaradamente lossy (RESEARCH §2).

A consequência central para o design: **a garantia de "alternar sem perda" não pode vir de parsing de HTML. Precisa vir da arquitetura de persistência.**

## Goals

1. Switch HTML ⇄ Blocos disponível na UI do editor, bidirecional.
2. **Perda zero** para qualquer combinação de blocos suportados, em qualquer número de idas e vindas — garantida estruturalmente (snapshot + fingerprint), não por parsing.
3. **Fallback gracioso obrigatório**: HTML manual que não corresponde a nenhum bloco vira bloco opaco de "HTML customizado" — preservado byte a byte, nunca descartado, nunca trava.
4. **Fonte de verdade única a cada instante**: `editorMode` é o árbitro; invariantes de persistência impedem `html` e `mailyJson` de divergirem sem re-sincronização explícita.
5. Testes automatizados de round-trip por tipo de bloco (`blocos → HTML → blocos` idempotente), como critério de aceite de cada estágio — padrão de testes já fixado nos demais módulos.
6. Corrigir os bugs residuais ativos/latentes da auditoria (template legado insalvável — AUDIT §5; `restoreVersion` divergente — AUDIT §3.4).

## Non-Goals

- **Reconstruir blocos nativos editáveis a partir de HTML arbitrário** (tabela customizada, `<style>` exótico). Isso é impossível de garantir com TipTap/ProseMirror (RESEARCH §3) e nem o Resend tenta (RESEARCH §2.3). HTML fora do padrão é *preservado* (opaco), não *convertido*.
- Editor colaborativo/tempo real; IA de composição; galeria de templates prontos (frentes futuras).
- Mudanças no fluxo de envio (`template.html` segue sendo o que o disparo consome — nada muda em campanha/cron).
- Migrar UseCases de e-mail para repositórios (allowlist mantida).

---

## Decisões arquiteturais

### D1 — Fonte de verdade por modo + snapshot com fingerprint (a garantia de perda zero) ⚠️ confirmar

`editorMode` deixa de ser um rótulo informativo e passa a ser **o árbitro do campo canônico**, com invariantes reforçadas no backend:

| Modo | Campo canônico | O outro campo |
|---|---|---|
| `blocks` | `mailyJson` (TipTap JSON) | `html` é **sempre** recompilado do JSON a cada save (artefato; nunca editado à mão) |
| `html` | `html` | `mailyJson` fica **congelado como snapshot** da última saída do modo blocos, junto com `blocksHtmlFingerprint` = hash do HTML compilado naquele momento |

Novo campo no schema: `blocksHtmlFingerprint String?` em `EmailTemplate` (hash SHA-256 do HTML normalizado gerado na última transição blocos→HTML; `null` quando nunca houve modo blocos).

**Troca de modo (re-sincronização explícita, sempre no momento da troca):**

- **Blocos → HTML**: compila JSON → HTML (`composeReactEmail`), grava `html`, grava `blocksHtmlFingerprint`, `editorMode = "html"`. Perda zero por definição (compilação, não conversão).
- **HTML → Blocos, Caso A (fingerprint confere — HTML não foi editado)**: restaura `mailyJson` do snapshot, `editorMode = "blocks"`. **Perda zero para 100% dos blocos, independente de versão de pacote — não passa por parsing.** É este caso que torna o round-trip garantível para todos os blocos suportados (responde à pergunta bloqueante (a) do prompt: **é garantível**; não é necessário travar a spec em alternativas de produto).
- **HTML → Blocos, Caso B (fingerprint não confere — HTML foi editado)**: importação best-effort com degradação graciosa (D3). O usuário é avisado no dialog de que trechos manuais viram blocos de HTML customizado.

Isto também fecha o gap da pergunta bloqueante (b): o schema hoje não sabe qual campo é o mais recente (AUDIT §4). Com D1, ele não precisa de timestamp — `editorMode` + invariantes tornam a pergunta indecidível de existir: em `blocks` o `html` é derivado; em `html` o `mailyJson` é snapshot datado pelo fingerprint. ⚠️ *Decisão explícita a confirmar pelo owner antes do Estágio 2 (é mudança de contrato de persistência).*

**Validação da hipótese do time (Fase 3):** a hipótese "unificar o HTML dos blocos com o HTML aceito de volta" (= `parseHTML` rules casando com o markup de exportação) **se sustenta apenas parcialmente**. Como mecanismo primário é insuficiente e frágil: o export envolve o documento em scaffold sem parse rules, o markup muda por versão (precedente tiptap#4089) e o próprio Resend declara a transição como lossy (RESEARCH §5). Ela é aproveitada como **otimização do Caso B** (fragmentos que casam com padrões conhecidos viram blocos nativos), nunca como garantia. A garantia é o Caso A.

### D2 — Engine do modo blocos: `@react-email/editor` (recomendado) ⚠️ decisão do owner

| Opção | Prós | Contras |
|---|---|---|
| **A (recomendada): `@react-email/editor`** (Geração 2, reinstalar ^1.x) | É o editor do próprio Resend (paridade visual é objetivo declarado do projeto); export `composeReactEmail` mantido pelo Resend; API pública `EmailNode`/`renderToReactEmail` — exatamente o que o bloco opaco de D3 precisa; já foi integrado antes (Inspector custom, upload de imagem — código recuperável de `c392fac8^`) | Dependência nova (foi removida); JSON legado da Geração 1 (Maily) é incompatível — precisa de D4 |
| B: `@maily-to/core` (Geração 1, já no package.json) | Dep já instalada | Não tem pipeline de export próprio no projeto (`@maily-to/render` nunca foi instalado — AUDIT §6); JSON incompatível com o ecossistema react-email; projeto de mantenedor único; a paridade visual com o Resend teria de ser reconstruída à mão |

Com a Opção A, `@maily-to/core` sai do `package.json` (órfão hoje — AUDIT §7). O nome da coluna `mailyJson` é mantido (renomear coluna não paga o churn de migration; o significado passa a ser "JSON de blocos do editor atual", documentado no schema).

### D3 — Fallback gracioso: bloco opaco `customHtml` + segmentação top-level no Caso B

Novo node `customHtml` (via `EmailNode.create`): atômico, guarda o HTML original **byte a byte** em atributo, renderiza preview sandboxed (iframe/`srcDoc`) no canvas com rótulo "HTML customizado", editável apenas como código (Monaco em dialog). Na exportação, `renderToReactEmail` emite o HTML intacto.

Importação do Caso B (HTML editado manualmente):

1. Extrai o corpo do documento (unwrap de `<html>/<head>/<body>` e do scaffold conhecido do nosso próprio export; `<style>` do head vira um bloco `customHtml` próprio para não ser perdido).
2. Segmenta os filhos top-level do body; cada fragmento tenta parse pelos `parseHTML` do StarterKit + regras adicionais para o markup do nosso export (a hipótese do time, como otimização).
3. Fragmento reconhecido ⇒ bloco nativo; fragmento não reconhecido **ou com perda detectada** (re-serialização normalizada difere do fragmento original) ⇒ bloco `customHtml` com o fragmento original. A detecção de perda por comparação é o que garante "nunca descartar silenciosamente".
4. Falha catastrófica de parse ⇒ documento inteiro vira um único bloco `customHtml` (nunca trava, nunca perde).

### D4 — Legado: `mailyJson` da Geração 1 (Maily) não abre no novo engine

Templates com `mailyJson` gravado pela Geração 1 têm JSON de schema incompatível (RESEARCH §4). Tratamento: permanecem `editorMode = "html"` (o backfill de 29/06 + default atual já os cobre); o snapshot legado **não** é usado para o Caso A (fingerprint `null` ⇒ sempre Caso B); migration de dados arquiva `mailyJson` legado em vez de deixá-lo enganar o novo editor — e o fix do bug AUDIT §5 (template legado insalvável) entra no mesmo estágio.

---

## Estágios de implementação

> Regras transversais (todas as etapas): `Route → UseCase → [Service] → Prisma`; UseCase retorna `Output`; `TeamContext` resolvido uma vez via `getTeamAccess()`; migrations só via `bun run db:migrate:from-prisma`/`db:migrate:new` (remoto só com autorização do owner); **testes unit + integração antes de considerar o estágio concluído — round-trip por tipo de bloco é critério de aceite, não nice-to-have**; validação `typecheck → lint → governance:check → lint:pt-br` (+ `design:check` em UI); tokens semânticos, sem hex em TSX; shadcn via MCP; sem `*_SUMMARY.md`.

### Estágio 1 — Lib pura de conversão + fixtures de markup + testes de round-trip (sem UI, sem schema)

**Prompt (copy-paste):**

```text
Leia EMAIL_TEMPLATE_EDITOR_SPEC.md (D1-D4) e EMAIL_TEMPLATE_EDITOR_AUDIT.md (§3, §6).
No lead-flow-app, sem tocar em UI nem schema:

1. Reinstale @react-email/editor (bunx/bun add, versão ^1 mais recente) e crie
   lib/email/editor-content/ com módulos puros e tipados:
   - compileBlocksToHtml(json): wrapper de composeReactEmail (JSON -> { html, text }).
   - htmlFingerprint(html): normalização determinística (trim, whitespace colapsado
     fora de <pre>, atributos ordenados) + SHA-256 hex. Documente no código que a
     normalização é parte do contrato do fingerprint.
   - importHtmlToBlocks(html): implementa o Caso B da D3 — unwrap de scaffold,
     segmentação top-level, parse por fragmento com detecção de perda por
     re-serialização comparada, fallback para node customHtml (crie a EmailNode
     customHtml em lib/email/editor-content/custom-html-node.tsx com
     renderToReactEmail emitindo o HTML intacto). Nunca lançar exceção para HTML
     malformado: retornar documento com bloco(s) customHtml.
2. Gere fixtures de snapshot do HTML exportado por CADA bloco suportado
   (TEXT, H1-H3, BULLET_LIST, NUMBERED_LIST, QUOTE, CODE, BUTTON, DIVIDER, SECTION,
   TWO/THREE/FOUR_COLUMNS, imagem, marks bold/italic/underline/strike/code/link,
   variável {{...}}) em lib/email/editor-content/__fixtures__/ — este é o contrato
   versionado do markup por bloco (AUDIT §6).
3. Testes (bun test) obrigatórios:
   a. Round-trip Caso A por bloco: compile -> fingerprint -> restauração do JSON
      (deep-equal com o JSON de origem) — para cada fixture.
   b. Round-trip Caso B por bloco: compile -> importHtmlToBlocks -> compile de novo;
      asserte que nenhum conteúdo textual/href/src se perde e que fragmentos não
      reconhecidos viram customHtml com o HTML original byte a byte.
   c. HTML hostil: tabela customizada, <style> no head, comentários condicionais,
      HTML truncado/malformado -> nunca lança, nada é descartado (tudo presente no
      re-export).
   d. Fingerprint: estável entre execuções; muda com qualquer edição significativa;
      não muda com whitespace irrelevante.
Rode a sequência de validação completa.
```

**Não tocar:** qualquer arquivo em `app/` (UI e rotas); `prisma/schema.prisma`; `EmailTemplateUseCase`; fluxo de envio.
**Aceite:** todos os testes de a–d verdes; fixture de snapshot por bloco commitada; `importHtmlToBlocks` nunca lança; cobertura de cada bloco listado em AUDIT §6.
**Validação manual:** rodar `bun test lib/email/editor-content` e inspecionar visualmente 2–3 fixtures (botão, colunas, imagem) confirmando que são HTML de e-mail plausível.

### Estágio 2 — Schema + invariantes de persistência no backend ⚠️ depende de D1 confirmada

**Prompt (copy-paste):**

```text
Leia EMAIL_TEMPLATE_EDITOR_SPEC.md (D1, D4) e EMAIL_TEMPLATE_EDITOR_AUDIT.md (§4, §5).
Backend do editor de templates:

1. Schema: adicione blocksHtmlFingerprint String? a EmailTemplate em
   prisma/schema.prisma; gere a migration com
   bun run db:migrate:from-prisma -- email-template-blocks-fingerprint.
   NÃO aplique no remoto sem autorização do owner.
2. Migration de dados (bun run db:migrate:new archive-legacy-maily-json): SQL
   idempotente que move mailyJson legado (editorMode = 'html' e mailyJson não nulo)
   para NULL — conforme D4 (JSON da Geração 1 é incompatível com o novo engine e
   nunca deve alimentar o Caso A; fingerprint permanece NULL).
3. EmailTemplateUseCase (create/update) — invariantes por modo, retornando Output:
   - editorMode 'blocks': mailyJson obrigatório E html obrigatório (compilado pelo
     frontend na gravação); grava blocksHtmlFingerprint recebido; rejeitar save de
     blocks sem os três campos coerentes.
   - editorMode 'html': html obrigatório; mailyJson do payload é IGNORADO
     (preserva o snapshot existente do banco — nunca rejeitar como hoje, fix do bug
     AUDIT §5); blocksHtmlFingerprint intocado.
   - Troca de modo é sempre um update explícito com editorMode novo + campos
     coerentes; valide as combinações e devolva mensagens de erro descritivas.
4. restoreVersion: ao restaurar uma versão, zere mailyJson e blocksHtmlFingerprint
   e force editorMode 'html' no novo draft (o html restaurado é a única fonte —
   fix da divergência latente AUDIT §3.4). Registre no history.
5. Frontend TemplateEditorService.toPayload: não enviar mailyJson quando
   editorMode === 'html' (alinhado à invariante).
6. Testes unit + integração: cada invariante de 3 e 4; save de template legado
   (mailyJson não nulo no banco) volta a funcionar; matriz de combinações
   editorMode × campos.
Atualize postman/Lead-Flow-API-Collection.json (payloads de templates).
Rode a sequência de validação completa.
```

**Não tocar:** fluxo de envio/campanhas/cron; rotas fora de `app/api/v1/email/templates/**`; UI do editor (Estágio 3); `EditorStudioTypes`.
**Aceite:** template legado salva sem erro; impossível persistir `blocks` sem `html`+`fingerprint` coerentes; `restoreVersion` nunca deixa `mailyJson` divergente; migration replay ok em `db:migrate:reset:local`; testes verdes.
**Validação manual:** criar template local, gravar via API nos dois modos (Postman), conferir colunas no banco local; salvar template legado semeado com `mailyJson` fake.

### Estágio 3 — UI: switch de modo com Caso A/B + editor de blocos reintroduzido

**Prompt (copy-paste):**

```text
Leia EMAIL_TEMPLATE_EDITOR_SPEC.md (D1-D3, mockups) e use a skill design-system-guard.
UI do editor (app/[supabaseId]/email/templates/[id]/features/**), padrão
features/context|services|container, shadcn via MCP, tokens semânticos, PT-BR:

1. Reintroduza o modo blocos com @react-email/editor (referência: versão em
   git show c392fac8^ — EmailEditorStudio com Inspector custom e upload de imagem),
   registrando a EmailNode customHtml do Estágio 1 nas extensões.
2. EditorStudioTypes: EditorMode = "html" | "blocks" de novo; TemplateEditorHook:
   resolveEditorMode(template) retorna template.editorMode (deixa de ser fixo).
3. Switch de modo (Tabs shadcn no cabeçalho do editor) com confirmação:
   - blocks -> html: sem aviso destrutivo (compilação); dialog informativo simples.
   - html -> blocks: calcular htmlFingerprint(html atual) no cliente;
     se === template.blocksHtmlFingerprint -> Caso A: restaurar mailyJson, sem aviso.
     senão -> Caso B: AlertDialog avisando que trechos manuais serão preservados
     como blocos "HTML customizado" (nunca dizer que serão perdidos — não serão);
     executar importHtmlToBlocks.
   - Toda troca dispara saveTemplate com o estado re-sincronizado (D1: a troca É a
     re-sincronização explícita). Botões com lock de request (disable até finally).
4. Bloco customHtml no canvas: preview em iframe sandbox com badge "HTML
   customizado" (Badge shadcn) e ação "Editar código" abrindo Dialog com
   MonacoCodeEditor (DialogContent max-h-[90vh] flex flex-col, área com
   overflow-y-auto flex-1, footer fixo).
5. Badge de modo atual no cabeçalho (substitui o badge fixo "HTML").
6. Efeitos de carga idempotentes (request key + in-flight guard, padrão do projeto).
7. Testes dos utilitários de UI (decisão Caso A/B, lock de troca) e atualização dos
   testes existentes do editor.
Rode a validação completa incluindo design:check.
```

**Não tocar:** backend (pronto no Estágio 2); `lib/email/editor-content` (pronto no Estágio 1, exceto bugfix com teste); painéis laterais existentes (variáveis, histórico, assets, vídeos, X-post) além do necessário para conviver com o novo modo; fluxo de teste/publicação.
**Aceite:** alternar blocos→HTML→blocos sem editar HTML restaura o documento idêntico (deep-equal, coberto por teste); editar HTML e voltar preserva 100% do conteúdo (nativo + opacos); nenhum caminho de troca perde dados nem trava; `design:check` verde.
**Validação manual:** roteiro completo no editor local — criar template em blocos com todos os tipos de bloco, alternar para HTML, voltar (Caso A), editar uma tag no HTML, voltar (Caso B), publicar, enviar teste.

**Mockup — switch de modo (antes/depois):**

```
ANTES  ┌ Editor ───────────────────── [HTML] ─────────────┐   (badge fixo, modo único)
       │ Monaco ......................... | Preview       │
       └───────────────────────────────────────────────────┘

DEPOIS ┌ Editor ────────────── [ Blocos ▣ | HTML ▢ ] ─────┐   ← Tabs shadcn
       │ (blocos)  ▤ H1  ▤ Texto  ▤ Botão  ▤ 2 colunas    │
       │ ...canvas com Inspector à direita...             │
       └───────────────────────────────────────────────────┘
       Troca html→blocos com HTML editado (Caso B):
       ┌ AlertDialog ─────────────────────────────────────┐
       │ Mudar para modo blocos?                          │
       │ Seu HTML foi editado manualmente. Trechos que    │
       │ não correspondem a blocos serão preservados como │
       │ blocos de "HTML customizado" (editáveis como     │
       │ código). Nada será descartado.                   │
       │              [Cancelar]  [Converter e continuar] │
       └──────────────────────────────────────────────────┘
```

**Mockup — bloco de HTML customizado (fallback):**

```
┌ canvas do modo blocos ──────────────────────────────────┐
│ ▤ H1  Bem-vindo, {{nome}}                               │
│ ┌─ ⟨/⟩ HTML customizado ────────────────── [Editar] ─┐  │ ← Badge + ação
│ │  (preview renderizada em iframe sandbox)           │  │
│ │  ┌──────────── tabela custom do usuário ─────────┐ │  │
│ └─────────────────────────────────────────────────────┘  │
│ ▤ Botão  [ Falar com corretor ]                          │
└──────────────────────────────────────────────────────────┘
```

### Estágio 4 — Hardening, legado e higiene

**Prompt (copy-paste):**

```text
Leia EMAIL_TEMPLATE_EDITOR_SPEC.md (D4, edge cases) e AUDIT §7. Feche a frente:

1. Testes de integração do fluxo completo (bun test): criar em blocos -> trocar ->
   editar HTML -> voltar -> publicar -> payload de envio contém o html esperado;
   template legado (mailyJson arquivado) abre em modo HTML e entra em blocos via
   Caso B; restoreVersion seguido de troca de modo não diverge.
2. Variáveis {{...}}: garantir extração/revisão de variáveis funcionando nos dois
   modos (discoverTemplateVariables sobre o html compilado ao sair de blocos) com
   teste para variável criada dentro de bloco e dentro de customHtml.
3. Conteúdo dos painéis que injetam HTML (assets, vídeos YouTube, post do X):
   no modo blocos, inserir como bloco customHtml (nunca colar no meio do JSON).
4. Remova @maily-to/core do package.json (dep órfã) e ajuste
   lib/landing/features-data.ts:42 para não citar "Maily"
   (ex.: "Editor visual de blocos + HTML"). NÃO tocar no headline hero da landing
   (contrato de copy do agents.md).
5. Documentar em .github/instructions/project-context.instructions.md a arquitetura
   D1 (fonte de verdade por modo + fingerprint) na seção do módulo de e-mail.
Rode a validação completa (incluindo design:check e lint:pt-br).
```

**Não tocar:** headline hero da landing (contrato); fluxo de campanhas; schema (fechado no Estágio 2).
**Aceite:** suíte completa verde; `grep -r "maily" app/ lib/ package.json` sem dep nem copy órfã (exceto coluna `mailyJson` e histórico); envio de campanha com template criado em blocos entrega o HTML compilado correto.
**Validação manual:** fluxo ponta a ponta local com envio de teste real; abrir template legado antigo e confirmar Caso B.

---

## Edge cases & error handling

- **HTML gigante / malformado** no Caso B: `importHtmlToBlocks` nunca lança — fallback para bloco opaco único (D3.4); limite de tamanho do preview em iframe.
- **Variáveis `{{...}}` dentro de HTML customizado**: continuam interpoladas no envio (a interpolação atua sobre o `html` final); a revisão de variáveis precisa varrer também os blocos opacos (Estágio 4.2).
- **Snapshot órfão**: `mailyJson` presente com `blocksHtmlFingerprint` nulo (legado pós-D4 não deve existir; se existir, tratar como Caso B). Coberto por invariante + teste.
- **Duas abas abertas** no mesmo template: a troca de modo salva; a segunda aba com estado velho deve falhar com mensagem clara (comparação de `updatedAt`/versão no update — comportamento atual de versão preservado).
- **Imagens data-URL** criadas na Geração 2: aceitas pelo import como bloco imagem; acima do limite, viram customHtml (nada se perde).
- **Bump de versão do `@react-email/editor`**: fixtures de snapshot do Estágio 1 quebram o CI se o markup mudar — o contrato torna a mudança visível em PR em vez de silenciosa (mitiga o precedente tiptap#4089).

## Security & privacy

- Preview de `customHtml` **sempre** em iframe `sandbox` (sem scripts) — o HTML é do próprio usuário, mas o editor não deve executá-lo no contexto da app.
- Sanitização na importação preserva o original no atributo do bloco (fidelidade), mas o *preview* renderiza versão sanitizada (DOMPurify, como na Geração 1 — `sanitizeImportedHtml`).
- Nenhuma mudança de superfície de API pública; rotas seguem `getTeamAccess()` + gates de role existentes.

## Success criteria

1. `blocos → HTML → blocos` idempotente (deep-equal) para todos os blocos do inventário AUDIT §6 — coberto por teste, por bloco.
2. Nenhum caminho de troca de modo descarta conteúdo (teste de HTML hostil verde; bloco opaco presente no re-export byte a byte).
3. Impossível persistir `html` e `mailyJson` divergentes (invariantes de Estágio 2 testadas).
4. Template legado com `mailyJson` salva e abre nos dois modos.
5. Zero regressão no fluxo HTML-only atual (editar/salvar/publicar/testar sem trocar de modo).

## Open questions (para o owner)

1. **D1 — confirmar** o contrato de persistência (fingerprint + snapshot + invariantes). Recomendação: aprovar como está.
2. **D2 — engine**: `@react-email/editor` (recomendada) ou `@maily-to/core`? A recomendação A implica reinstalar a dep removida em `c392fac8`.
3. **Granularidade do Caso B**: segmentação por fragmento top-level (recomendada, D3) ou versão mínima com documento inteiro em um único bloco opaco (menos útil, mais simples — pode ser o corte do Estágio 1 se o prazo apertar)?
4. Copy da landing (`features-data.ts`) menciona "Maily" — trocar por texto neutro no Estágio 4 (item 4). Confirmar redação.

## Decisions log

- 2026-07-07 — Pesquisa + auditoria concluídas; spec proposta. Confirmado que Resend não faz round-trip (JSON-first, saída lossy declarada) e que a hipótese do time (parseHTML rules pareadas com o export) só se sustenta como otimização best-effort do Caso B — a garantia de perda zero vem do snapshot + fingerprint (D1). Perguntas bloqueantes do prompt: (a) round-trip sem perda **é garantível** para todos os blocos suportados via Caso A — não foi necessário travar a spec; (b) gap "qual campo é o mais recente" confirmado no schema e resolvido estruturalmente por D1 — pendente de confirmação do owner antes do Estágio 2.
