<!-- CANONICAL AI GOVERNANCE FILE: agents.md -->
# Lead Flow - AI Implementation Governance

**Version:** 2.3.0
**Last Updated:** 2026-04-06
**Canonical Source:** `agents.md` (single source of truth)
**Adapter Files:** generated with `bun run governance:sync`

This document defines the implementation governance for AI agents in this repository. It is intentionally normative.

## Normative Keywords

- **MUST**: mandatory rule.
- **MUST NOT**: prohibited behavior.
- **SHOULD**: recommended default unless there is a justified exception.
- **LEGACY EXCEPTIONS**: allowed temporary deviations, explicitly listed in `.governance/ai-governance.config.json` (source of truth for governance checks).
- **FOR NEW FEATURES**: rules that apply to all net-new feature work.

## Project Context Reference

- Agents **MUST** read `.github/instructions/project-context.instructions.md` at the start of every session or task to obtain full project context: tech stack, design system, database schema, architecture patterns, integrations, and conventions.
- This file is the authoritative reference for implementation details not covered by governance rules.

## Source of Truth and Distribution

- Agents **MUST** treat `agents.md` as the canonical instruction file.
- Adapter files (`.github/copilot-instructions.md`, `.cursor/rules/lead-flow-agents.mdc`, `CLAUDE.md`, `AGENTS.md`) **MUST** be generated from this file.
- Team members and agents **MUST NOT** manually edit generated adapter files.
- Whenever any AI governance/instruction file is changed, the equivalent rule update **MUST** be propagated to every generated adapter in the same change by running `bun run governance:sync`.
- An AI-governance rule change is **NOT** complete until the canonical file and every generated adapter reflect the same rule set.
- `AGENTS.md` is treated as a logical alias for `agents.md` in governance checks to prevent cross-platform case-collision issues.
- `.github/agents.md` is intentionally not generated to avoid confusion with the canonical file name.
- Regenerate adapters: `bun run governance:sync` — Validate: `bun run governance:check`

## Core Architecture

### Backend (FOR NEW FEATURES)

Target flow: `Route -> UseCase -> [Service] -> Prisma`

- Routes (`app/api/v1/**/route.ts`) **MUST** handle HTTP concerns only (parse request, call use case/service, map status code).
- UseCases (`app/api/useCases/**`) **MUST** orchestrate business logic and **MUST** return `Output` (`lib/output/index.ts`).
- Services (`app/api/services/**`) **SHOULD** hold complex domain logic.
- Routes **MUST NOT** call Prisma directly for new code.
- `app/api/infra/data/prisma.ts` **MUST** remain the shared Prisma client boundary.
- New product API code **MUST** follow the canonical `app/api` layout — see `.github/instructions/project-context.instructions.md` for the full folder tree.

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

## Project Rules

### MUST NOT

- Create implementation summary docs (`*_IMPLEMENTATION_SUMMARY.md`, `*_FIX_SUMMARY.md`, similar).
- Use npm or yarn (project standard is Bun).
- Hardcode URLs when `NEXT_PUBLIC_APP_URL` or `getFullUrl()` should be used.
- Use browser-native dialogs (`window.alert`, `window.confirm`, `window.prompt`, or global equivalents). Use shadcn `AlertDialog`/`Dialog` and `sonner` instead.

### MUST

- Search and align with existing patterns before introducing new structures.
- Use strict TypeScript typing.
- Use `console.info` for flow logs and `console.error` for errors.
- In route-level error logs, identify routes by stable name + HTTP method (e.g. `[SubscriptionBySupabaseRoute][GET]`).
- Services (frontend and backend) **MUST** follow interface + concrete implementation.
- When creating a new backend endpoint, update `postman/Lead-Flow-API-Collection.json` and `postman/Lead-Flow-Environment.json` when applicable.
- Keep behavioral consistency in legacy paths unless the task explicitly includes refactor.

### FOR NEW FEATURES

- Implementation code **MUST** be written in TypeScript. JavaScript and Python **MUST NOT** be used.

### SHOULD

- Keep route handlers thin and use descriptive success/error messages.
- Use existing module naming conventions before creating new naming patterns.

## Request and Interaction Safety (FOR NEW FEATURES)

### useEffect Request Discipline

- Data-fetching effects **MUST** be idempotent and implement deduplication: stable request key, in-flight guard, last-success key guard.
- Effects **MUST NOT** depend on unstable function/object identities that recreate requests on every render.
- Reuse data already available in existing Context providers before creating a new fetch for the same domain.

### Action Button Request Lock

- Any button triggering backend mutation **MUST** lock on first click: set loading state immediately, disable trigger while pending, prevent re-entry until `finally`.
- Submit actions **MUST** remain disabled until all required inputs pass validation.

## LEGACY EXCEPTIONS

Deviations allowed only if explicitly listed in `.governance/ai-governance.config.json`. Categories: `prismaInV1RouteAllowlist`, `useCaseWithoutOutputAllowlist`, `frontendFeatureStructureAllowlist`, `nonTypeScriptFileAllowlist`. When refactoring removes an exception, update the allowlist in the same PR.

## Automated Enforcement

CI **MUST** fail when governance checks fail.

- Check: `bun run governance:check`
- Allowlist warnings (non-blocking): `bun run governance:warn-allowlist`

## Feature Scaffolding

Use `bun run scaffold:feature -- --name <feature-name>` for new feature baseline. Agents **SHOULD** start from scaffold and then adapt business logic.

## Pull Request Checklist (MUST)

- [ ] Seguiu `agents.md`?
- [ ] Criou excecao legada? Se sim, justificou e atualizou allowlist?
- [ ] Criou endpoint backend novo? Atualizou `postman/Lead-Flow-API-Collection.json` e, quando aplicavel, `postman/Lead-Flow-Environment.json`?
- [ ] Rodou `bun run typecheck` e `bun run lint`?
- [ ] Rodou `bun run governance:check`?

## Environment Essentials

`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`

## References

- Output type: `lib/output/index.ts`
- Auth middleware: `middleware.ts`
- Asaas config: `lib/asaas.ts`
- Full project context: `.github/instructions/project-context.instructions.md`
- Prompt templates: `.github/instructions/leads-flow-instructions.instructions.md`
