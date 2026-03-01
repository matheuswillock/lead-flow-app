<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Source: agents.md -->
<!-- Regenerate with: bun run governance:sync -->

<!-- CANONICAL AI GOVERNANCE FILE: agents.md -->
# Lead Flow - AI Implementation Governance

**Version:** 2.1.3
**Last Updated:** 2026-03-01
**Canonical Source:** `agents.md` (single source of truth)
**Adapter Files:** generated with `bun run governance:sync`

This document defines the implementation governance for AI agents in this repository. It is intentionally normative.

## Normative Keywords

- **MUST**: mandatory rule.
- **MUST NOT**: prohibited behavior.
- **SHOULD**: recommended default unless there is a justified exception.
- **LEGACY EXCEPTIONS**: allowed temporary deviations, explicitly listed in `.governance/ai-governance.config.json`.
- **FOR NEW FEATURES**: rules that apply to all net-new feature work.

## Source of Truth and Distribution

- Agents **MUST** treat `agents.md` as the canonical instruction file.
- Adapter files (`.github/copilot-instructions.md`, `.cursor/rules/lead-flow-agents.mdc`, `CLAUDE.md`, `AGENTS.md`) **MUST** be generated from this file.
- Team members and agents **MUST NOT** manually edit generated adapter files.
- On case-insensitive filesystems (for example Windows), `AGENTS.md` resolves to the same canonical file path as `agents.md`.
- `.github/agents.md` is intentionally not generated to avoid confusion with the canonical file name.
- Regenerate adapters with:

```bash
bun run governance:sync
```

- Validate governance and architecture rules with:

```bash
bun run governance:check
```

## Core Architecture

### Backend (FOR NEW FEATURES)

Target flow:

`Route -> UseCase -> [Service] -> Prisma`

- Routes (`app/api/v1/**/route.ts`) **MUST** handle HTTP concerns only (parse request, call use case/service, map status code).
- UseCases (`app/api/useCases/**`) **MUST** orchestrate business logic.
- Services (`app/api/services/**`) **SHOULD** hold complex domain logic.
- Data access **SHOULD** live in UseCases/Services.
- Routes **MUST NOT** call Prisma directly for new code.

### Frontend (FOR NEW FEATURES)

Preferred flow:

`Page -> Context (Types -> Hook -> Provider) -> Service -> Container`

- New tenant features under `app/[supabaseId]/[feature]` **SHOULD** use:
  - `features/context`
  - `features/services`
  - `features/container`
- Simpler pages can remain direct only if complexity does not justify full context layering.
- Any direct-page deviation **SHOULD** be justified in PR description.

## Output Contract Policy

- New UseCases **MUST** return `Output` (`lib/output/index.ts`) unless explicitly approved as a legacy-compatible exception.
- Routes consuming Output-based use cases **SHOULD** map `result.isValid` to HTTP status codes.

Output shape:

```typescript
new Output(
  isValid: boolean,
  successMessages: string[],
  errorMessages: string[],
  result: unknown,
)
```

## API Routing Policy

- Product APIs **FOR NEW FEATURES** **MUST** use `/api/v1/...`.
- Infrastructure endpoints outside `/api/v1` are valid for specific purposes (for example `/api/webhooks/*`, `/api/auth/*`, `/api/email/*`).

## Critical Integration Points

### Supabase Auth

- Session refresh and route access are enforced in `middleware.ts` via `updateSession(request)`.
- Current protected prefixes: `/dashboard`, `/account`, `/board`, `/pipeline`, `/manager-users`.
- Current public routes include: `/`, `/sign-in`, `/sign-up`, `/subscribe`, `/checkout-return`, `/operator-confirmed`, `/pix-confirmed`, `/set-password`, `/forgot-password`.

### Asaas

- Webhook entrypoint: `app/api/webhooks/asaas/route.ts`.
- Payment/subscription event handling logic: `app/api/services/PaymentValidation/PaymentValidationService.ts`.
- Webhook token header `asaas-access-token` **MUST** match `ASAAS_WEBHOOK_TOKEN`.

## Project Rules

### MUST NOT

- Create implementation summary docs (`*_IMPLEMENTATION_SUMMARY.md`, `*_FIX_SUMMARY.md`, similar generated summaries).
- Use npm or yarn (project standard is Bun).
- Hardcode URLs when `NEXT_PUBLIC_APP_URL` or `getFullUrl()` should be used.

### MUST

- Search and align with existing patterns before introducing new structures.
- Use strict TypeScript typing.
- Use `console.info` for flow logs and `console.error` for errors.
- Keep behavioral consistency in legacy paths unless the task explicitly includes refactor.

### FOR NEW FEATURES

- Implementation code **MUST** be written in TypeScript.
- JavaScript and Python files **MUST NOT** be used to implement new features.
- Non-TypeScript files are allowed only via explicit `LEGACY EXCEPTIONS` in `.governance/ai-governance.config.json`.

### SHOULD

- Prefer service interfaces for testability and clear boundaries.
- Keep route handlers thin and use descriptive success/error messages.
- Use existing module naming conventions before creating new naming patterns.

## LEGACY EXCEPTIONS

Legacy deviations are allowed only if explicitly listed in `.governance/ai-governance.config.json`.

Current tracked exception categories:

1. `prismaInV1RouteAllowlist`
2. `useCaseWithoutOutputAllowlist`
3. `frontendFeatureStructureAllowlist`
4. `nonTypeScriptFileAllowlist`

Known examples currently tracked:

- Non-Output UseCases:
  - `app/api/useCases/payments/PaymentValidationUseCase.ts`
  - `app/api/useCases/subscriptions/CheckSubscriptionUseCase.ts`
- Feature structure exception example:
  - `app/[supabaseId]/teams`

When refactoring removes an exception, the allowlist **MUST** be updated in the same PR.

## Automated Enforcement

The repository enforces these rules through CI.

- Governance check command:

```bash
bun run governance:check
```

- Legacy allowlist warning command (non-blocking):

```bash
bun run governance:warn-allowlist
```

Validation includes:

1. Canonical file metadata and required keywords.
2. Adapter file sync with `agents.md`.
3. Direct Prisma usage in `app/api/v1/**/route.ts` (blocked except explicit allowlist).
4. Output contract presence in new UseCases (blocked except explicit allowlist).
5. Frontend feature structure checks for new tenant features.
6. Non-TypeScript files in repository (blocked unless explicit legacy allowlist).

CI **MUST** fail when governance checks fail.

## Feature Scaffolding Standard

Use scaffold command for new feature baseline:

```bash
bun run scaffold:feature -- --name <feature-name>
```

The scaffold creates:

- Backend: Route + UseCase + Service
- Frontend: Page + Context (Types/Hook/Provider) + Service + Container

Agents **SHOULD** start from scaffold and then adapt business logic.

## Pull Request Checklist (MUST)

Every PR **MUST** confirm:

- [ ] Seguiu `agents.md`?
- [ ] Criou excecao legada? Se sim, justificou e atualizou allowlist?
- [ ] Rodou `bun run typecheck` e `bun run lint`?
- [ ] Rodou `bun run governance:check`?

## Environment Essentials

Critical environment variables include:

- `DATABASE_URL`, `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL`

## References

- Output type: `lib/output/index.ts`
- Auth middleware: `middleware.ts`
- Asaas config: `lib/asaas.ts`
- Architecture details: `.github/instructions/leads-flow-instructions.instructions.md`
