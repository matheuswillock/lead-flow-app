<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Source: agents.md -->
<!-- Regenerate with: bun run governance:sync -->

<!-- CANONICAL AI GOVERNANCE FILE: agents.md -->
# Lead Flow - AI Implementation Governance

**Version:** 2.6.0
**Last Updated:** 2026-08-16
**Canonical Source:** `agents.md` (single source of truth)
**Adapter Files:** generated with `bun run governance:sync`

This document defines the implementation governance for AI agents in this repository. It is intentionally normative.

## Normative Keywords

- **MUST**: mandatory rule.
- **MUST NOT**: prohibited behavior.
- **SHOULD**: recommended default unless there is a justified exception.
- **LEGACY EXCEPTIONS**: allowed temporary deviations, explicitly listed in `.governance/ai-governance.config.json` (source of truth for governance checks).
- **FOR NEW FEATURES**: rules that apply to all net-new feature work.

## Communication Style

- Do NOT explain what you are about to do before doing it. Just do it.
- Do NOT summarize what you just did after doing it.
- Do NOT ask for confirmation on tasks that were clearly requested.
- Do NOT narrate file reads, searches or tool calls.
- Only speak when you have a question that genuinely blocks progress, or when the task is fully done.
- When done, report only: what changed and any errors found.

**Exceção — trabalho visual de superfície pública.** As regras acima **MUST NOT**
ser usadas para pular o gate de perguntas do [Landing Page Method](#landing-page-method-must).
Numa landing page, briefing incompleto **é** um bloqueio genuíno de progresso:
sem público, ação única e fatos citáveis, o agente inventa. Perguntar ali é
obrigatório, não é pedir confirmação.

## Working Style

- Prefer sessions focused on one layer at a time (backend OR frontend, not both).
- Read at most 5 files before starting implementation. Do not explore the codebase extensively without necessity.
- Before deleting any record, check for FK constraints in the schema.
- **MUST NOT** apply, deploy, push, resolve or reset migration updates in any shared or remote database without explicit authorization from the project owner.
- **MUST NOT** refactor source code with scripts — regex, `sed`, `awk` or `python` rewriting files in bulk — without explicit authorization from the project owner. Refactors **MUST** be applied one edit at a time through the editor tooling, so every change is reviewed in context and fails loudly when the target text does not match. Bulk rewriting hides malformed output behind a substitution counter and defers type errors that a single edit surfaces immediately. Scripts remain allowed for read-only analysis (counting, searching, measuring).
<!-- - Use `db push` (not migrations) with Supabase. Stop the dev server before running `prisma generate`. -->

## Clean Code & SOLID (MUST)

Applies to **all** work, not only new features — including brainstorming and implementation planning in plain text, before any code is written, for both frontend and backend.

- Agents **MUST** use the `clean-code` skill before: technical brainstorming, implementation planning, and writing or refactoring code (frontend or backend). Do NOT skip this step because the task "looks small."
- Meaningful names: variables, functions, classes, UseCases, Services and Repositories **MUST** have pronounceable, searchable names that describe intent — no obscure abbreviations.
- Functions **MUST** be small and do one thing at one level of abstraction (Single Responsibility applied to functions). Prefer a typed options object over 3+ positional parameters. Avoid boolean flag parameters that change a function's behavior.
- SOLID **MUST** guide the design of UseCase/Service/Repository/Context:
  - **SRP** — one UseCase covers one business use case; Service holds domain logic, not HTTP parsing; Route holds no business rules.
  - **OCP** — prefer composition/strategy over a growing `if/else`/`switch` when adding a new variation.
  - **LSP** — any concrete Service/Repository implementation **MUST** be substitutable for its interface without breaking the consumer.
  - **ISP** — Service/Repository interfaces **MUST** stay lean (interface + concrete implementation, already a project MUST).
  - **DIP** — UseCases **MUST** depend on a Service/Repository interface, never call Prisma/raw SQL directly (enforced by `governance:check`, see [Automated Enforcement](#automated-enforcement)).
- DRY **MUST NOT** become an excuse for premature abstraction — this reinforces the existing rule against adding abstractions beyond what the task requires (see [Working Style](#working-style)). Duplication of business knowledge should be eliminated; a few similar lines should not.
- Reference: [clean-code-javascript](https://github.com/felipe-augusto/clean-code-javascript), adapted to this repository's TypeScript/Next.js/Prisma stack via the `clean-code` skill.
- Touching a file listed in `dipPrismaInUseCaseAllowlist` (or another Clean Code/SOLID-related legacy exception in `.governance/ai-governance.config.json`) **MUST** trigger an immediate refactor of that violation as part of the same change, with the entry removed from the allowlist. This **MUST** already be surfaced during brainstorming/planning — before any code is written — not discovered mid-implementation. If the requested scope is genuinely incompatible with the refactor, the conflict **MUST** be raised explicitly to the user, never silently skipped.

## Git Branch & Pull Request Workflow (MUST)

The repository has three fully CI-automated PR flows. Agents **MUST** rely on them instead of acting manually:

| Push to | Workflow | What it does |
|---------|----------|---------------|
| `feature/*`, `bugfix/*` (and `cursor/*`, `Codex/*`) | `ci-feature.yml` / `ci-bugfix.yml` / `ci-cursor.yml` / `ci-Codex.yml` → `ci-branch-reusable.yml` (`auto-pr` job) | Creates/updates the PR into `develop` automatically. |
| `develop` | `ci-develop.yml` (`auto-pr-develop-to-main` job) | Resets/force-pushes the `release/develop-to-main` branch from the validated `develop` commit and creates/updates the PR into `main`. |
| `main` | `ci-sync-develop.yml` | Creates/updates the sync-back PR (`features/sync-main-to-develop` → `develop`). |

### Before starting new work (MUST)

Before creating or starting work on a `feature/*` or `bugfix/*` branch, agents **MUST** update the local branch from `develop` first (e.g. `git fetch origin develop && git checkout -b <branch> origin/develop`, or `git pull origin develop` if the branch already exists) to avoid a stale base and avoidable merge conflicts.

### Pull Requests are pipeline-only (MUST NOT)

Agents **MUST NOT** create Pull Requests manually (via `gh pr create` or the GitHub UI) for any of the three flows above, under any circumstances. These PRs **MUST** be created exclusively by the CI jobs listed. The correct flow is: push the branch and verify the CI opened/updated the PR (`gh pr list --head <branch>`) — never open one manually.

### Protected branches — no direct commits (MUST NOT)

Agents **MUST NOT** commit or push directly to `main`, `develop`, or any `release/*` branch (e.g. `release/develop-to-main`), under any circumstances — not even to resolve review comments on a PR already open against one of these branches. `release/*` branches are entirely CI-managed (recreated/force-pushed from `develop` on every push); a direct commit is overwritten on the next `develop` push or creates history inconsistency.

To resolve review comments on a `develop → main` PR (via `release/develop-to-main`): make the fix on a **new** `feature/*` or `bugfix/*` branch with its own PR into `develop` (opened automatically by CI). CI then regenerates `release/develop-to-main` and updates the PR into `main` automatically. Never commit directly onto `release/*` branches. For `feature/bugfix → develop` PRs, push fixes directly to the existing head branch — the auto-PR will update seamlessly.

## Migration Policy (Supabase CLI + Prisma ORM)

The migration workflow uses **Supabase CLI** as the source of truth for migration history. Prisma is used only as an ORM (client generation, schema introspection, local `db push`). The legacy `prisma/migrations/` directory has been archived to `legacy/prisma-migrations/`.

### Creating migrations (MUST)

Agents **MUST NOT** create migration files manually in `supabase/migrations/` (hand-crafted timestamps, copy/paste, or rename-only flows). Every new file **MUST** originate from the Supabase CLI.

| Change type | Command | SQL |
|-------------|---------|-----|
| **Schema** (`prisma/schema.prisma` — models, enums, indexes) | `bun run db:migrate:from-prisma -- <migration-name>` | Auto-generated via `prisma db push` (local) + `supabase db diff -f` — **review before remote push** |
| **Manual** (RLS, triggers, functions, seeds, publications, extensions) | `bun run db:migrate:new <migration-name>` | Written by hand in the generated file |

**Schema workflow** (requires local Supabase on port 55322):

```bash
# Preview diff without writing a file
bun run db:migrate:from-prisma -- --dry-run <migration-name>

# Generate supabase/migrations/<timestamp>_<migration-name>.sql
bun run db:migrate:from-prisma -- <migration-name>

# Validate replay
bun run db:migrate:reset:local
```

**Manual workflow** (RLS, data seeds, etc.):

```bash
bun run db:migrate:new <migration-name>
# Edit the generated SQL file (idempotent when possible)
```

All migrations **MUST** be idempotent when possible (`IF EXISTS`, `IF NOT EXISTS`, `CREATE OR REPLACE`).

### Physical table/column names (MUST) — anti-drift com `@@map`

Fonte de verdade do schema de banco:

1. **`prisma/schema.prisma`** — models, enums, campos, índices e **nomes físicos** via `@@map` / `@map` / `@@map` de enums.
2. **`app/api/infra/data/prisma.ts`** — único boundary do `PrismaClient` compartilhado (não define DDL; agents **MUST NOT** inventar client/tabela/coluna fora do que o schema declara).

Antes de escrever qualquer SQL em `supabase/migrations/**`, `$queryRaw` / `$executeRaw`, ou DDL manual:

- Agents **MUST** ler o `model`/`enum` correspondente em `prisma/schema.prisma` e usar **somente** o nome físico mapeado (`@@map("...")` / `@map("...")`).
- Agents **MUST NOT** usar o nome do model Prisma como nome de tabela/relação em SQL (ex.: `"RadarProfile"`, `"Lead"`) quando existir `@@map` — isso quebra em runtime (`relation "…" does not exist`) porque SQL raw e migrations **não** passam pelo `@@map`.
- Agents **MUST NOT** inventar tabelas/colunas/enums “parecidos” com o domínio (ex.: `"RadarConsent"` quando o model é `RadarChannelConsent` mapeado para `corretor_studio_radar_channel_consents`).
- Em migrations geradas por `db:migrate:from-prisma`, agents **MUST** revisar o SQL e confirmar que `CREATE TABLE` / `ALTER TABLE` / `REFERENCES` usam os nomes físicos do schema — não o nome do model.
- Preferir Prisma Client (que resolve `@@map`) a SQL raw. Se SQL raw for inevitável, cada identificador de tabela/coluna **MUST** bater com o `@map`/`@@map` do schema na mesma mudança.

Incidente de referência: `RADAR_AUDIT.md` §9 B1 (`countFixedSegmentsSQL` usou nomes de model em `$queryRaw`).

### Applying migrations to remote (MUST)

```bash
bun run db:migrate:push:dry-run   # review first
bun run db:migrate:push           # apply to linked remote
```

Agents **MUST NOT** run `db:migrate:push` or any SQL Editor change on the remote without explicit authorization from the project owner.

After an authorized push, check status with:

```bash
bun run db:migrate:status
```

### Local development (MUST)

```bash
bun run db:migrate:reset:local    # reset local Supabase DB and re-apply all migrations
bun run prisma:db:push            # sync schema.prisma to local DB (no migration history)
```

### Supabase/Postgres features (MUST)

RLS policies, functions, triggers, grants, publications (`supabase_realtime`), extensions and Auth Hooks **MUST** be written as manual SQL inside a migration file created with `bun run db:migrate:new`. They **MUST NOT** be applied via Supabase SQL Editor except as emergency hotfixes, which must be reconciled into a migration file before the task is complete.

## Automated Validation (FOR ALL CHANGES)

After every edit, automatically run in this order:

```bash
# Rode, capture o EXIT, só então filtre a saída — `| head` devolve o status do
# head, não o do typecheck. Ver "Teste que não sabe falhar não é verificação".
bun run typecheck > /tmp/lf-typecheck.log 2>&1; echo "typecheck EXIT=$?"; head -20 /tmp/lf-typecheck.log
bun run lint
bun run governance:check
bun run governance:check-e2e-pages
bun run governance:check-api-masking
bun run lint:pt-br
```

  Rules:
    - O `EXIT` de cada comando **MUST** ser lido. `EXIT` diferente de 0 = tarefa não concluída. Saída vazia sem `EXIT=0` impresso **MUST NOT** ser reportada como sucesso — é o formato típico de OOM.
    - Do NOT skip these commands even for small changes.
    - Do NOT ask for confirmation to run them.
    - Do NOT report the task as done if any command fails.
    - Fix all errors immediately before moving to the next file or task.
    - If `governance:check` fails, fix the violation before continuing — do not add to allowlist unless explicitly instructed.
    - If `governance:check-api-masking` fails, replace hardcoded `/api/v1/...` client calls with `API_CLIENT_BASE` — do not add to `clientApiPathMaskingAllowlist` unless explicitly instructed.
    - If `lint:pt-br` fails, fix the accentuation in the flagged UI text — only add the word to `IGNORE_WORDS` in `scripts/lint-pt-br.ts` when it is a proper noun/brand/technical term that is correct as written.

## Visual Implementation (FOR NEW FEATURES)

### Design Reference (MUST)

Before implementing any UI screen, modal, form, or component:

1. Read `DESIGN.md` — it is the canonical source for all tokens,
   typography, spacing, and visual direction.
2. Use the `corretor-studio-design` skill to generate a design brief
   before writing any JSX. Do NOT skip this step for new screens.
3. Never use hardcoded hex values in JSX/TSX for themable UI.
   Always use semantic CSS variable tokens.
4. Never manually edit CSS regions managed by `design:sync`
   in `app/globals.css`.
5. Read `PRODUCT.md` — brand personality, tom de voz e a lista de
   anti-references. É fonte obrigatória para qualquer copy de UI, não opcional.
6. Choose skills with `docs/design/ROTEAMENTO-SKILLS-DESIGN.md`.
   Do NOT load a design skill by description match — a maioria das ~99 skills
   instaladas contradiz `DESIGN.md`.

### shadcn MCP Workflow (MUST)

Before creating any visual component, use the shadcn MCP server:

1. `shadcn:search_items_in_registries` — search for the component.
2. `shadcn:view_items_in_registries` — inspect its full API and variants.
3. `shadcn:get_add_command_for_items` — get the install command.
4. Run the install command with Bun: `bunx --bun shadcn@latest add <component>`.
5. Only create custom markup if the component does not exist in the registry.

Never install shadcn components with npm or yarn. Always use `bunx --bun shadcn@latest`.

### shadcn Composition Rules (MUST)

- Use `FieldGroup` + `Field` for all forms. Never use raw `div` with `space-y-*`.
- Use `gap-*` instead of `space-y-*` or `space-x-*` everywhere.
- Use `size-*` instead of `w-* h-*` when width and height are equal.
- Use semantic color tokens (`bg-primary`, `text-muted-foreground`) —
  never raw Tailwind colors like `bg-blue-500` or `text-gray-600`.
- Never add manual `dark:` color overrides — semantic tokens handle light/dark.
- Never add `z-index` to overlay components (Dialog, Sheet, Drawer, Popover, Tooltip).
- Use `cn()` from `@/lib/utils` for conditional class names — never manual ternaries.
- Icons inside Button use `data-icon="inline-start"` or `data-icon="inline-end"`.
  No sizing classes (`size-4`, `w-4`, `h-4`) on icons inside shadcn components.
- Always use the project icon library: `lucide-react` (check `components.json`).
- Avatar always needs `AvatarFallback`.
- Dialog, Sheet, and Drawer always need a Title (use `sr-only` if visually hidden).
- Use `Skeleton` for loading states — never custom `animate-pulse` divs.
- Use `Badge` for status indicators — never custom styled spans.
- Use `Separator` instead of `<hr>` or `<div className="border-t">`.
- Use `sonner` for toast notifications — never browser-native `alert`.

### Design Validation (MUST)

Add `bun run design:check` to the validation sequence after every UI change:

```bash
bun run typecheck > /tmp/lf-typecheck.log 2>&1; echo "typecheck EXIT=$?"; head -20 /tmp/lf-typecheck.log
bun run lint
bun run governance:check
bun run governance:check-e2e-pages
bun run design:check
```

If `design:check` fails, run `bun run design:sync` and commit the result.

`design:check` só compara os blocos de token de `DESIGN.md` com as regiões
marcadas em `app/globals.css`. Ele **não** abre nenhum `.tsx`, não mede
contraste e não olha a tela. Passar no `design:check` **MUST NOT** ser
reportado como "aderente ao design system".

### Visual Verification (MUST)

Aplica-se a **toda** mudança visual — landing, app autenticado, backoffice,
modal, formulário ou componente isolado. Nenhum comando da sequência de
validação renderiza a tela: `design:check` compara blocos de token,
`governance:check` não tem validador de contraste, hex ou responsividade, e a
cobertura mínima de página E2E é funcional. Verde em todos eles **MUST NOT** ser
tratado como evidência de que a tela está correta.

Antes de reportar qualquer trabalho visual como concluído, o agente **MUST**
observar a tela renderizada. Ordem de fallback:

1. Playwright (`bun run test:e2e:local`, ou o MCP quando disponível)
2. Preview / dev server
3. `Codex-in-chrome`
4. Pedir um screenshot ao dono

Verificar **MUST** incluir, no mínimo: a tela carrega sem erro de console, o
conteúdo aparece no viewport pretendido, e não há overflow horizontal em 360px.

Se as quatro opções falharem, o agente **MUST** declarar em texto —
*"não verificado visualmente — apenas leitura estática"* — e **MUST NOT**
reportar a tarefa como concluída. Reler o próprio código, reexecutar
`typecheck`/`lint` ou reinspecionar o diff **MUST NOT** ser tratado como
substituto de olhar a tela.

#### Receita de setup (o que faz a tela abrir)

Cada item abaixo já custou horas de diagnóstico. A falha típica não é a tela
quebrada — é o ambiente falhar e o agente ler isso como bug da aplicação, ou
pior, como "verificado".

1. **Localmente, copie `.env.test.example` para `.env.test`.**
   `playwright.config.ts` só carrega o arquivo se ele existir, e com
   `override: false` — variável já exportada no shell vence o arquivo. Sem as
   variáveis a spec morre com `E2E_JWT_SECRET ausente` ou
   `[e2e] DATABASE_URL is required for Prisma`. Na CI não existe arquivo:
   `.github/actions/run-e2e-playwright/action.yml` despeja o `.env.test.example`
   no `$GITHUB_ENV` e sobrescreve o que precisa.
2. **`bun run test:e2e:local` NÃO sobe o Next.** Ele seta `E2E_REUSE_SERVER=1`,
   que remove o bloco `webServer` — o servidor é responsabilidade sua, e ele
   precisa do `E2E_JWT_SECRET`. **Exportar só `APP_ENV=test` e
   `E2E_TEST_MODE=true` não basta**: `bun run dev` roda com
   `NODE_ENV=development`, e o `@next/env` só inclui `.env.test` quando
   `NODE_ENV=test`; `scripts/dev-local.ts` faz `import "dotenv/config"`, que lê
   apenas `.env`. Sem o segredo no processo do servidor, o cookie assinado pelo
   Playwright é rejeitado e a tela redireciona para o login — sintoma que parece
   bug de aplicação.

   ```bash
   set -a; source .env.test; set +a     # o mesmo arquivo que a spec usa
   bun run dev
   # noutro terminal:
   bun run test:e2e:local -- e2e/specs/<arquivo>.spec.ts
   ```

   A lista canônica do que o servidor precisa está em `playwright.config.ts`
   (bloco `webServer.env`) — hoje `APP_ENV`, `E2E_TEST_MODE` e
   `PUBLIC_FORM_LEAD_GATE_MODE`. Alternativa sem dev server:
   `bun run build && bun run test:e2e` — o `webServer` roda `next start`, que
   **exige build de produção**; sem ele o Playwright só falha depois do timeout
   de 90s.
3. **Sessão entra por cookie assinado**, não por login: `injectE2eAuthCookie`
   (`e2e/fixtures/auth.ts`) recebe o `context`, não a `page`.
4. **Marque o "what's new" como visto** com `context.addInitScript`, não com
   `page.evaluate`: antes do primeiro `goto` a página é `about:blank` e tocar
   `localStorage` ali estoura `SecurityError`. A chave é
   `whats-new:seen:${WHATS_NEW_VERSION}:${supabaseId}` — a versão vem de
   `WHATS_NEW_VERSION` em `components/whats-new-modal.tsx`, **MUST NOT** ser
   fixada como `v1` no teste. Sem isso um modal cobre a tela e o assert falha
   por elemento interceptado.
5. **Espere CONDIÇÃO, nunca tempo fixo.** Em dev o Next compila sob demanda e a
   primeira renderização varia de segundos a dezenas de segundos. `sleep` fixo
   produz screenshot de estado vazio que parece bug de dados. Faça poll de um
   seletor ou contador até aparecer.
6. **Isole dado da UI antes de acusar a tela.** Se a tela vier vazia, chame a
   API pela própria página e compare. API com dado + tela vazia é timing ou
   render; API vazia é seed.

Para `browser-harness` em Linux, se `browser-harness --doctor` disser
`active browser connections — 0` com o Chrome aberto: existe sim o toggle
"Allow remote debugging for this browser instance" em
`chrome://inspect/#remote-debugging`, mas ele só passa a valer depois de reabrir
o Chrome, e não funciona se o Chrome vier do Snap/Flatpak. Quando reabrir a
sessão do dono não for aceitável, suba uma instância separada com
`--remote-debugging-port` e `--user-data-dir` próprio e conecte via
`BU_CDP_URL`.

A verificação **MUST** ser medida, não julgada: leia valores do DOM
(`scrollWidth`, `getComputedStyle`, texto da célula) em vez de descrever o
screenshot.

### Teste que não sabe falhar não é verificação (MUST)

Vale para teste automatizado e para script de medição.

- Ao criar um teste que trava comportamento crítico — ordem de efeito colateral,
  atomicidade, shape de resposta — o agente **MUST** executar um **controle
  negativo**: quebrar de propósito o comportamento no código de produção,
  confirmar que o teste fica vermelho, e restaurar conferindo por `git diff` que
  o arquivo voltou idêntico. Teste verde sem esse passo não é evidência.
- O teste **MUST** exercitar o código real. Reproduzir o padrão dentro dos
  próprios mocks passa sempre e não protege de nada.
- O teste **MUST NOT** depender de variável de ambiente que exista só na máquina
  do agente. Um `getFullUrl()` dentro de um `try` faz o caminho feliz cair no
  `catch` num runner sem `NEXT_PUBLIC_APP_URL` — e a falha aparece como
  regressão de código na CI. Neutralize com `mock.module`.
- Comando cujo resultado o agente vai reportar **MUST NOT** ter o exit code
  mascarado por pipe. `bun run typecheck 2>&1 | head -20` esconde OOM: o
  processo morre, nada é impresso, e o silêncio parece sucesso. Rode, capture o
  `EXIT`, e só então filtre a saída.

## Landing Page Method (MUST)

Aplica-se a toda página pública de marketing/aquisição (`app/page.tsx` e
subárvores com `.landing-page`). Método completo em
`docs/design/METODO-LANDING-PAGE.md`. Roteamento de skills em
`docs/design/ROTEAMENTO-SKILLS-DESIGN.md`.

### Gate de briefing (bloqueante)

O agente **MUST NOT** escrever JSX de landing antes de fazer estas 8 perguntas
numa única mensagem e receber resposta. Nenhuma tem default — **sem resposta, o
trabalho para.**

1. A página usa o tema `.landing-page` (light-only) ou herda o tema do app?
2. Quem é o leitor e o que ele já sabe sobre o produto?
3. Qual é a **única** ação que a página precisa provocar?
4. Quais números podem ir ao ar, e qual a fonte de cada um?
5. Existe depoimento real e **autorizado por escrito**? Se não, a seção não existe.
6. Que claim é proibido? (promessa de resultado, "grátis", prazo, comparação)
7. Quais seções, em que ordem?
8. É **preserve** (mantém estrutura) ou **overhaul** (reescreve)?

### Inventário de fatos (MUST)

Produza `docs/design/landing-fatos-<slug>.md` com a tabela
`claim | valor | fonte (arquivo:linha ou pessoa) | pode ir ao ar (S/N)`.

- **Seção sem fato na tabela não existe.**
- Fontes: `PRODUCT.md`, `PRICING_TABLE.md` (só o que está ✅ vigente vai ao ar),
  `PRICING_MODEL.md`, `SEO-PAGE-*.md`.
- Número sem fonte **MUST NOT** ir para a UI, nem como fallback. Quando o dado
  real não existe, a seção **MUST** ser escondida — ver `hasPublishableStats()`
  em `lib/landing/stats-data.ts`. Zero também não vai ao ar: "+0 corretores
  ativos" é pior que faixa nenhuma.
- Prova social (depoimento, nome, empresa, nota) **MUST** ter autorização por
  escrito de quem é citado. Sem isso a seção não existe — **MUST NOT** criar
  persona de exemplo "para preencher o layout".

Precedentes já removidos deste repo, para não serem recriados: `31%` e `4,9/5`
hardcoded na faixa de stats; um `landingStatsFallback` de 280 corretores /
1,2M de leads que entrava silenciosamente quando a query falhava; e um
`TestimonialsSection` com três depoimentos de pessoas inexistentes. Os três
passavam em `typecheck`, `lint`, `governance:check` e `design:check`.

### Copy aprovada antes de código (MUST)

A copy de todas as seções **MUST** ser escrita em texto puro e aprovada pelo
dono **antes** do primeiro commit em `app/` ou `components/landing/`.

### Verificação medida (MUST)

Além da [Visual Verification](#visual-verification-must), que vale para toda
tela, a landing **MUST** ter asserts medidos na spec E2E — não julgamento:

- contraste: nenhum par abaixo de 4.5 (texto) / 3.0 (UI)
- alvo de toque ≥ 44×44
- `document.documentElement.scrollWidth <= window.innerWidth + 1` em 360 e 375
- `prefers-reduced-motion` respeitado

## Project Context Reference

- Agents **MUST** read `.github/instructions/project-context.instructions.md` at the start of every session or task to obtain full project context: tech stack, design system, database schema, architecture patterns, integrations, and conventions.
- This file is the authoritative reference for implementation details not covered by governance rules.

## Source of Truth and Distribution

- Agents **MUST** treat `agents.md` as the canonical instruction file.
- Adapter files (`.github/copilot-instructions.md`, `.cursor/rules/lead-flow-agents.mdc`, `AGENTS.md`, `AGENTS.md`) **MUST** be generated from this file.
- Team members and agents **MUST NOT** manually edit generated adapter files.
- Whenever any AI governance/instruction file is changed, the equivalent rule update **MUST** be propagated to every generated adapter in the same change by running `bun run governance:sync`.
- An AI-governance rule change is **NOT** complete until the canonical file and every generated adapter reflect the same rule set.
- `AGENTS.md` is treated as a logical alias for `agents.md` in governance checks to prevent cross-platform case-collision issues.
- `.github/agents.md` is intentionally not generated to avoid confusion with the canonical file name.
- Regenerate adapters: `bun run governance:sync` — Validate: `bun run governance:check`

## Backoffice Module Isolation (FOR NEW FEATURES)

The backoffice (`app/backoffice/**` + `app/api/v1/backoffice/**` + `app/api/webhooks/backoffice/**`) is treated as an **independent module** that is a candidate to be extracted into its own service in the future. To keep this option open, AI agents working on backoffice features **MUST**:

- Use **dedicated database tables** prefixed with `Backoffice*` (existing examples: `BackofficeUser`, `BackofficeClient`, `BackofficePayment`). New backoffice domain entities **MUST NOT** be added to existing product tables (`Lead`, `LeadActivity`, `Profile` etc.) — even when columns look similar, the data must live in a separate `Backoffice*` table.
- Use **dedicated enums** prefixed with `Backoffice*` (e.g. `BackofficeLeadStatus`) rather than reusing product enums like `LeadStatus`.
- Place backoffice-only API routes under `app/api/v1/backoffice/**` and webhooks under `app/api/webhooks/backoffice/**` (e.g. `app/api/webhooks/backoffice/meta/route.ts`). Backoffice routes **MUST NOT** be co-located with product routes.
- Place backoffice-only services, use cases and repositories under `app/api/services/backoffice*/`, `app/api/useCases/backoffice*/` and `app/api/infra/data/repositories/backoffice*/`. Backoffice code **MUST NOT** import product use cases, services or repositories that are not also part of the backoffice module — and vice-versa.
- Authorize backoffice routes with `getBackofficeAccess()` (`app/api/v1/backoffice/utils/getBackofficeAccess.ts`). Backoffice routes **MUST NOT** call `getTeamAccess()` (which is the product authorization helper).
- Use environment variables prefixed with `BACKOFFICE_` for backoffice-specific secrets (e.g. `BACKOFFICE_META_VERIFY_TOKEN`) so they do not collide with product variables.

The single allowed cross-module coupling is `Profile` (Supabase identity) and the `BackofficeUser.profileId` link. Anything else **MUST** be duplicated rather than shared.

## Core Architecture

### Backend (FOR NEW FEATURES)

Target flow: `Route -> UseCase -> [Service] -> Prisma`

- Routes (`app/api/v1/**/route.ts`) **MUST** handle HTTP concerns only (parse request, call use case/service, map status code).
- UseCases (`app/api/useCases/**`) **MUST** orchestrate business logic and **MUST** return `Output` (`lib/output/index.ts`).
- Services (`app/api/services/**`) **SHOULD** hold complex domain logic.
- Routes **MUST NOT** call Prisma directly for new code.
- `app/api/infra/data/prisma.ts` **MUST** remain the shared Prisma client boundary.
- New product API code **MUST** follow the canonical `app/api` layout — see `.github/instructions/project-context.instructions.md` for the full folder tree.
- Prisma queries **MUST** prefer `select` over `include` by default.
- `include` **MUST** be used only when the full related entity is intentionally required by the use case.
- For list endpoints and CRM flows, queries **MUST** select only fields consumed by the response/DTO and UI.

### Frontend (FOR NEW FEATURES)

Target flow: `page -> context -> service` / `page -> container -> context`

Every new page **MUST** use page-local feature architecture with the canonical `features/` layout:

```text
app/[route]/
  page.tsx          # thin entrypoint — no dense logic, no direct HTTP calls
  loading.tsx
  features/
    context/        # *Types.ts, *Hook.ts, *Context.tsx (required)
    services/       # I*Service.ts + *Service.ts (required)
    container/      # *Container.tsx (required)
    components/     # optional presentational subcomponents
    types/          # optional shared feature-local types
    validation/     # optional schemas/validators
    hooks/          # optional extra hooks
    utils/          # optional pure helpers
```

- `features/context` centralizes state, orchestration, and calls `features/services` for remote communication.
- `features/services` isolates HTTP/API integration; **MUST** use interface + concrete implementation.
- Visual components in `features/container` **MUST NOT** call backend APIs directly.
- Optional folders **MUST NOT** be created empty or replace the required baseline.

### E2E Tests (FOR NEW FEATURES)

Playwright (`@playwright/test`), Chromium. Specs live in `e2e/specs/<dominio>/<slug>.spec.ts`. Página, rota ou fluxo novo sem spec **MUST NOT** contar como entregue.

#### Ciclo TDD (MUST)

1. Escrever a spec **antes** do código (red).
2. Implementar até a spec ficar verde.
3. Refatorar. A fase/PR só fecha quando a spec está verde na CI **e**, se a página estava em `e2ePageCoverageAllowlist`, ela **saiu** da allowlist.

#### Convenção de path

Route groups `(app)` saem; segmentos dinâmicos viram o nome do param:

- `app/[supabaseId]/subscription/page.tsx` → `e2e/specs/product/subscription.spec.ts`
- `app/backoffice/(app)/pricing/page.tsx` → `e2e/specs/backoffice/pricing.spec.ts`
- `app/adesao/[token]/page.tsx` → `e2e/specs/checkout/adesao.spec.ts`

Domínios: `product` (`[supabaseId]/**`), `backoffice`, `checkout` (`adesao`, `addon-checkout`, `checkout-return`), `public` (resto).

Um spec **MAY** cobrir lista+detalhe via `e2ePageCoverage.coveredBy` em `.governance/ai-governance.config.json`.

#### Como montar uma spec nova

1. Copiar `e2e/specs/_template.spec.ts`.
2. `test.describe` com o nome da rota. `test.beforeEach` chama o fixture de sessão (`e2e/fixtures/auth.ts`) e o seed mínimo (`e2e/support/db.ts`) quando existirem.
3. Arrange no banco (Prisma), Act no Playwright (`page.goto` + interações), Assert na UI **e** no banco.
4. Cobertura mínima de página: carrega sem erro, título/heading visível, CTA principal funciona, estado vazio ou de loading com `Skeleton` (não crash).
5. Feature de cobrança: além do mínimo, assertir produto, ciclo, valor e a **ausência do termo CDP**. Toda spec que cria customer, cobrança, checkout ou assinatura no Asaas **MUST** usar homologação (`ASAAS_ENV=sandbox`, API em `sandbox.asaas.com`) e chamar `assertAsaasSandbox()` de `e2e/support/asaas.ts` no `beforeAll`. **MUST NOT** apontar para produção (`www.asaas.com` / `ASAAS_ENV=production` / `ASAAS_API_KEY` de prod). O helper falha o teste antes de qualquer request se o ambiente não for sandbox.
6. Rodar local: `bun run test:e2e:local -- e2e/specs/<arquivo>.spec.ts` com o Postgres `:55322` **e o app** já no ar — esse script não sobe o Next (ver [Receita de setup](#receita-de-setup-o-que-faz-a-tela-abrir)).

#### Página nova (MUST)

Todo `app/**/page.tsx` novo **MUST** ter spec no mesmo PR. Exceção só via `e2ePageCoverageAllowlist` com instrução explícita do owner. A allowlist **MUST NOT crescer** — só encolhe. Exclusões fixas (não são produto): `app/sentry-example-page`, `app/auth/callback`.

Check: `bun run governance:check-e2e-pages` (também entra em `governance:check`). Página sem spec e fora da allowlist → **falha**. Spec órfã → warning.

Quando a mudança toca UI ou cobrança, a sequência de validação **MUST** incluir `bun run build && bun run test:e2e` — o job Playwright já roda na CI (`.github/actions/run-e2e-playwright`, usado por `ci-branch-reusable`, `ci-develop` e `ci-main`).

### Visual Components (FOR NEW FEATURES)

- Any net-new visual component **MUST** start with the `shadcn` skill workflow before implementation.
- Agents **MUST** prefer existing `shadcn/ui` components before introducing custom markup.
- Use Bun-based commands: `bunx --bun shadcn@latest ...`

## Output Contract Policy

New UseCases **MUST** return `Output` (`lib/output/index.ts`) unless explicitly approved as a legacy exception.

```typescript
new Output(isValid: boolean, successMessages: string[], errorMessages: string[], result: unknown)
```

Routes consuming Output-based use cases **SHOULD** map `result.isValid` to HTTP status codes.

## API Routing Policy

- Product APIs **FOR NEW FEATURES** **MUST** use `/api/v1/...`.
- Infrastructure endpoints outside `/api/v1` are valid for specific purposes (`/api/webhooks/*`, `/api/auth/*`, `/api/email/*`).

## Critical Integration Points

- **Supabase Auth:** Session refresh enforced in `middleware.ts` via `updateSession(request)`.
- **Asaas:** Webhook entrypoint `app/api/webhooks/asaas/route.ts`; token header `asaas-access-token` **MUST** match `ASAAS_WEBHOOK_TOKEN`.

### Webhook Handler Policy (FOR NEW FEATURES)

All webhook handlers **MUST** follow the pattern: **respond with HTTP 200 immediately, process asynchronously, retry on failure**. This protects the application from blocking on external provider requests and ensures no events are silently lost.

1. **Always respond 200 quickly** — `{ received: true }, { status: 200 }` **BEFORE** any processing. Providers like Resend only retry non-2xx responses, so a 200 response acts as an acknowledgment. Do not return `500` for processing failures; the provider has no context to retry a failure that originated in our code.
2. **Process in background** — Use `after()` (Next.js 15.1+) or a fire-and-forget async block, never synchronous processing in the handler. Webhook signature verification happens before this point (401 if invalid); processing errors happen after (safe to hide from the provider).
3. **Persist failures to an outbox table** — When processing throws, create a row in a `*Outbox` table (`EventOutbox`, `WebhookProcessingFailure`, etc.) with the original event payload, status `pending`, and attempt metadata.
4. **Implement a retry cron** — Poll the outbox every 5 minutes via a dedicated cron handler (`/api/v1/cron/retry-*-failures`). Claim `pending` rows atomically, reprocess with exponential backoff, mark `resolved` or `failed` (dead-letter) after max attempts. **Retry failures must be observable and never infinite.**
5. **Dedupe on idempotency keys** — Use database constraints (e.g. `@@unique([webhookId, eventType, occurredAt])`) to prevent duplicate processing if the provider retries or we accidentally reprocess the same event.

**Example:** `app/api/webhooks/resend/route.ts` (status 200 → verify signature → queue in `after()`) + `app/api/v1/email/cron/retry-resend-webhook-failures/route.ts` (poll `ResendWebhookProcessingFailure`, retry with backoff). See `EMAIL_SPEC.md` Estágio 10 / D11 for the full spec.

## Project Rules

### MUST NOT

- Commit or push directly to protected branches, or create Pull Requests manually — see [Git Branch & Pull Request Workflow](#git-branch--pull-request-workflow-must).
- Create implementation summary docs (`*_IMPLEMENTATION_SUMMARY.md`, `*_FIX_SUMMARY.md`, similar).
- Use npm or yarn (project standard is Bun).
- Use the `Bun.*` runtime global in `app/**` or `lib/**` (production runs on Node at Vercel; Bun is only the local script runner). Use portable APIs instead (e.g. `bcryptjs`, `node:crypto`). Enforced by `governance:check`.
- Hardcode URLs when `NEXT_PUBLIC_APP_URL` or `getFullUrl()` should be used.
- Create routes/folders/files with ambiguous or generic names that don't describe intent (e.g. `me`, `data`, `misc`, `temp`, `utils2`).
- Use browser-native dialogs (`window.alert`, `window.confirm`, `window.prompt`, or global equivalents). Use shadcn `AlertDialog`/`Dialog` and `sonner` instead.
- Hardcode `/api/v1/...` in client-side HTTP calls (`fetch`, axios, URL constants consumed by the browser). Use `API_CLIENT_BASE` from `@/lib/route-map` so the Network tab shows `/api/q/...` (rewritten by `proxy.ts`). Enforced by `governance:check` (`clientApiPathMaskingAllowlist` for LEGACY EXCEPTIONS only).
- Create `DialogContent` without scroll support when the content may overflow the viewport. Every `DialogContent` with non-trivial content **MUST** use `max-h-[90vh] flex flex-col` on the `DialogContent`, a scrollable inner `div` with `overflow-y-auto flex-1` wrapping the form fields, and a fixed `DialogFooter` outside the scrollable area.

### MUST

- Search and align with existing patterns before introducing new structures.
- Use strict TypeScript typing.
- Use `console.info` for flow logs and `console.error` for errors.
- In route-level error logs, identify routes by stable name + HTTP method (e.g. `[SubscriptionBySupabaseRoute][GET]`).
- Name routes/folders/files with a descriptive domain or action that matches the payload/intent (e.g. `current-user`, `account`, `users`, `leads`) and keep naming consistent across frontend, backend and Postman.
- When renaming a route or API contract, update all callers in the same change (frontend fetch/services, Postman collection, docs).
- Services (frontend and backend) **MUST** follow interface + concrete implementation.
- When creating a new backend endpoint, update `postman/Lead-Flow-API-Collection.json` and `postman/Lead-Flow-Environment.json` when applicable.
- Keep behavioral consistency in legacy paths unless the task explicitly includes refactor.

### Landing Page Copy Contract

- The landing page hero headline is a product contract and **MUST** remain exactly:
  `Corretores comuns mandam cotações. Os de ALTA PERFORMANCE usam Corretor Studio.`
- Landing page hero copy **MUST** reinforce FOMO (Fear of Missing Out) and performance/advantage positioning.

### FOR NEW FEATURES

- Implementation code **MUST** be written in TypeScript. JavaScript and Python **MUST NOT** be used.
- Client-side HTTP calls **MUST** use `API_CLIENT_BASE` from `@/lib/route-map` (never hardcode `/api/v1/...`). Prefer Server Components / Server Actions when the request can leave the browser entirely.

### SHOULD

- Keep route handlers thin and use descriptive success/error messages.
- Use existing module naming conventions before creating new naming patterns.

## Request and Interaction Safety (FOR NEW FEATURES)

### useEffect Request Discipline

- Data-fetching effects **MUST** be idempotent and implement deduplication: stable request key, in-flight guard, last-success key guard.
- Effects **MUST NOT** depend on unstable function/object identities that recreate requests on every render.
- Reuse data already available in existing Context providers before creating a new fetch for the same domain.

### TeamContext Reuse in Backend Routes (FOR NEW FEATURES)

- Routes that call `getTeamAccess()` **MUST** extract `TeamContext` (`profileId` + `teamMember`) from the result and pass it through the call chain: `Route → UseCase → Service → Repository`.
- Use cases and services **MUST** accept `ctx: TeamContext` as a parameter and forward it to repository methods instead of triggering a new `profile` + `teamMember` lookup.
- Repository methods **MUST** provide a `WithCtx` variant (e.g. `findLeadsWithCtx`, `getStatusMetricsWithCtx`) that accepts `TeamContext` directly, skipping the internal `getTeamContext()` call.
- The pair `profile.findUnique + teamMember.findUnique` **MUST NOT** be executed more than once per HTTP request. `getTeamAccess()` is the single point of resolution.

### Action Button Request Lock

- Any button triggering backend mutation **MUST** lock on first click: set loading state immediately, disable trigger while pending, prevent re-entry until `finally`.
- Submit actions **MUST** remain disabled until all required inputs pass validation.

## LEGACY EXCEPTIONS

Deviations allowed only if explicitly listed in `.governance/ai-governance.config.json`. Categories: `prismaInV1RouteAllowlist`, `dipPrismaInUseCaseAllowlist`, `useCaseWithoutOutputAllowlist`, `frontendFeatureStructureAllowlist`, `nonTypeScriptFileAllowlist`, `clientApiPathMaskingAllowlist`. When refactoring removes an exception, update the allowlist in the same PR.

## Automated Enforcement

CI **MUST** fail when governance checks fail.

- Check: `bun run governance:check` (inclui validação model `@@map` ↔ `CREATE TABLE` em `supabase/migrations/**`, DIP em UseCases sem Prisma direto — ver [Clean Code & SOLID](#clean-code--solid-must) — e cobertura E2E de `page.tsx`)
- Client API masking (CI step dedicado): `bun run governance:check-api-masking`
- E2E page coverage (CI step dedicado): `bun run governance:check-e2e-pages`
- Allowlist warnings (non-blocking): `bun run governance:warn-allowlist`

## Feature Registration Policy (FOR NEW FEATURES)

Every new feature that uses a `featureSlug` (visible in the sidebar via `FEATURE_SLUGS.*`) **MUST** be registered in the database. Defining the constant in `lib/features/feature-slugs.ts` alone is **not sufficient** — without a corresponding row in `backoffice_features`, `hasAccess(slug)` returns `false` for all users and the feature is invisible.

### Registration is two-step (MUST)

**1. Data migration** — `bun run db:migrate:new seed-<feature-slug>`

The generated file **MUST** contain idempotent SQL that inserts the feature and its access rules:

```sql
-- Insert feature (child of parent slug, or top-level if no parentSlug)
INSERT INTO "public"."backoffice_features"
  ("id","slug","name","accessMode","defaultAccessLevel","betaEnabled","sortOrder","productSlug","parentId","isActive","createdAt","updatedAt")
SELECT gen_random_uuid(), '<slug>', '<Name>', '<MODE>', '<LEVEL>', false, <sortOrder>, '<productSlug>',
       (SELECT "id" FROM "public"."backoffice_features" WHERE "slug" = '<parentSlug>'),
       true, now(), now()
ON CONFLICT ("slug") DO NOTHING;

-- Insert access rules
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT "id" INTO v_id FROM "public"."backoffice_features" WHERE "slug" = '<slug>';
  IF v_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id","featureId","principal","accessLevel","createdAt","updatedAt")
    VALUES
      (gen_random_uuid(), v_id, 'MASTER',           '<LEVEL>', now(), now()),
      (gen_random_uuid(), v_id, 'MANAGER',          '<LEVEL>', now(), now()),
      -- ... remaining principals with appropriate levels
    ON CONFLICT ("featureId","principal") DO NOTHING;
  END IF;
END $$;
```

**2. Seed file update** — `prisma/seed-backoffice-products.ts`

Add the feature to both:
- `FEATURES` array (slug, name, accessMode, defaultAccessLevel, betaEnabled, sortOrder, parentSlug, productSlug)
- `ACCESS_RULES_BY_SLUG` record using `completeRuleSet([...])` with the intended principals

Run `bun run db:seed:backoffice-products` locally after editing to verify correctness.

### Why both?

The migration guarantees the row reaches production via the tracked migration pipeline. The seed file ensures local dev environments and CI database resets stay consistent with production.

### PR checklist item

The PR checklist entry below covers this: "Criou nova feature com featureSlug? Registrou em backoffice_features via migration de dados e atualizou seed-backoffice-products.ts?"

## Feature Scaffolding

Use `bun run scaffold:feature -- --name <feature-name>` for new feature baseline. Agents **SHOULD** start from scaffold and then adapt business logic.

## Pull Request Checklist (MUST)

- [ ] Seguiu `agents.md`?
- [ ] Fez pull da `develop` antes de iniciar a branch de trabalho?
- [ ] Confirmou que nenhum PR foi criado manualmente e que nenhum commit foi feito direto em `main`/`develop`/`release/*`?
- [ ] Criou migration ou SQL raw? Schema via `bun run db:migrate:from-prisma -- <name>` ou manual via `db:migrate:new`; confirmou nomes físicos (`@@map`/`@map` em `prisma/schema.prisma`) — nunca nome de model Prisma como tabela; boundary de client em `app/api/infra/data/prisma.ts`; aplicou remoto somente com autorização?
- [ ] Criou excecao legada? Se sim, justificou e atualizou allowlist?
- [ ] Criou endpoint backend novo? Atualizou `postman/Lead-Flow-API-Collection.json` e, quando aplicavel, `postman/Lead-Flow-Environment.json`?
- [ ] Criou nova feature com `featureSlug`? Registrou em `backoffice_features` via migration de dados (`bun run db:migrate:new seed-<slug>`) **e** atualizou `prisma/seed-backoffice-products.ts`?
- [ ] Rodou `bun run typecheck` e `bun run lint`?
- [ ] Rodou `bun run governance:check`?
- [ ] Rodou `bun run governance:check-e2e-pages`?
- [ ] Rodou `bun run governance:check-api-masking`?
- [ ] Criou ou alterou `page.tsx` / fluxo de cobrança? Spec E2E no mesmo PR (TDD) e, se a página estava na allowlist, ela saiu de `e2ePageCoverageAllowlist`?

## Environment Essentials

`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`

## References

- Output type: `lib/output/index.ts`
- Auth middleware: `middleware.ts`
- Asaas config: `lib/asaas.ts`
- Full project context: `.github/instructions/project-context.instructions.md`
- Prompt templates: `.github/instructions/leads-flow-instructions.instructions.md`
