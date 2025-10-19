<!-- .github/copilot-instructions.md - concise, actionable instructions for AI coding agents -->
# Lead Flow — Copilot instructions (concise)

Follow these repository-specific rules when implementing changes. Keep answers short and only modify code; avoid creating implementation-summary docs.

- Architecture (must follow): Route → UseCase → [Service] → Prisma.
  - Routes (app/api/v1/*/route.ts): only HTTP parsing and status codes.
  - UseCases (app/api/useCases/*): business validations/orchestration — MUST return the project's Output type (see `lib/output/index.ts`).
  - Services (app/api/services/*): complex domain logic and transformations only.
  - Prisma usage is restricted to UseCase or Service layers (do not put DB logic directly in routes).

- Output pattern (required):
  - Always return `new Output(isValid:boolean, successMessages:string[], errorMessages:string[], result:any)` from UseCase methods.
  - Routes should map `result.isValid` → HTTP status (e.g. 200/201 for success, 400 for client errors, 500 for unexpected).
  - Example: See `app/api/useCases/metrics/` for patterns.

- Naming & file layout (follow examples):
  - UseCase interface: `app/api/useCases/[feature]/I[Feature]UseCase.ts`
  - UseCase impl: `app/api/useCases/[feature]/[Feature]UseCase.ts`
  - Service (optional): `app/api/services/[Feature]Service.ts`
  - Route: `app/api/v1/[feature]/route.ts`

- Frontend patterns (where applicable):
  - Page → Context (SOLID types→hook→provider) → Service → Components.
  - Look at `app/[supabaseId]/dashboard/features/context/` for a full example.
  - Services should call `/api/v1/*` and expect the Output-shaped JSON.

- Dev workflows & important commands (use Bun where present):
  - Install: `bun install`
  - Dev: `bun run dev`
  - Typecheck: `bun run typecheck`
  - Prisma: `bun run prisma:generate`, `bun run prisma:migrate` (see `package.json` scripts)
  - Use Ngrok when testing Asaas webhooks (README & docs explain setup). `bun run dev` + `ngrok http 3000`.

- Project-specific rules you must follow:
  - NEVER create implementation summary MD files (e.g. `*_IMPLEMENTATION_SUMMARY.md`) — the repo disallows these.
  - ALWAYS consult similar existing code before adding files (search `app/api/useCases/` and `app/[supabaseId]/...`).
  - Use descriptive commit messages: `type(scope): short description` and include bullet points in body.

- Error handling & logging:
  - Use `console.error` in catch blocks inside UseCases/Services for server-side errors.
  - Return `new Output(false, [], ['Human-friendly error message'], null)` on predictable validation failures.

- Helpful locations to inspect before coding:
  - `lib/output/index.ts` — Output class and shape
  - `app/api/useCases/metrics/` — complete UseCase + Service example
  - `app/api/useCases/profiles/` — pattern with Service
  - `app/[supabaseId]/dashboard/` — frontend context & provider examples
  - `package.json` — scripts and Bun/prisma commands

- Examples (short):
  - Route: parse query/body → call UseCase → return NextResponse.json(result, { status })
  - UseCase: validate inputs → call Service/prisma → return Output

If anything in the codebase looks inconsistent with these rules, stop and ask for clarification. Provide a short list of files you plan to change before making edits. Ask me if any external credentials (ASAAS, Supabase) or environment specifics are needed for testing.

Please review this file and tell me if you'd like any extra examples or links added (tests, CI steps, or common PR reviewers).
