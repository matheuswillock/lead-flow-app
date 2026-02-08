<!-- .github/copilot-instructions.md - Essential guidance for AI coding agents -->
# Lead Flow — Copilot Instructions

**Corretor Studio** is a Next.js 15.5 CRM for health insurance brokers using Clean Architecture principles. Keep answers short and implement changes directly—avoid creating implementation summary docs.

## Core Architecture

**Backend (Clean Architecture):** `Route → UseCase → [Service] → Prisma`
- **Routes** (`app/api/v1/*/route.ts`): HTTP layer only—parse requests, return responses with status codes
- **UseCases** (`app/api/useCases/*/`): Business logic orchestration—MUST return `Output` type (see `lib/output/index.ts`)
- **Services** (`app/api/services/*.ts`): Optional complex domain logic, calculations, transformations
- **Prisma**: Data access only (via UseCase or Service, never directly from routes)

**Frontend (SOLID Context Pattern):** `Page → Context (Types→Hook→Provider) → Service → Components`
- **Page** (`app/[supabaseId]/[feature]/page.tsx`): Top-level provider wrapper
- **Context** (`features/context/`): State management with SOLID separation (Types, Hook, Context)
- **Service** (`features/services/`): API calls expecting `Output` format
- **Container** (`features/container/`): Presentation components consuming context

**Key Pattern - Output Response:**
```typescript
// ALL UseCases must return:
new Output(isValid:boolean, successMessages:string[], errorMessages:string[], result:any)

// Routes map to HTTP status:
const status = result.isValid ? 200 : 400; // or 201, 404, 500 based on context
return NextResponse.json(result, { status });
```

## File Structure Conventions

**Backend UseCase Pattern:**
```
app/api/useCases/[feature]/
├── I[Feature]UseCase.ts       # Interface
├── [Feature]UseCase.ts        # Implementation (returns Output)
app/api/services/
└── [Feature]Service.ts        # Optional domain logic
app/api/v1/[feature]/
└── route.ts                   # HTTP endpoints
```

**Frontend Context Pattern (SOLID):**
```
app/[supabaseId]/[feature]/
├── page.tsx                   # Provider wrapper
└── features/
    ├── context/
    │   ├── [Feature]Types.ts      # Interfaces (I[Feature]State, I[Feature]Actions)
    │   ├── [Feature]Hook.ts       # Logic with useCallback
    │   └── [Feature]Context.tsx   # Provider (uses useParams for supabaseId)
    ├── services/
    │   ├── I[Feature]Service.ts   # Interface
    │   └── [Feature]Service.ts    # Implementation
    └── container/
        └── [Feature]Container.tsx # Main UI component
```

## Development Workflow

**Package Manager:** Use Bun (not npm/yarn)
```bash
bun install                 # Install dependencies
bun run dev                 # Start dev server (port 3000)
bun run typecheck           # Type checking
```

**Database (Prisma):**
```bash
bun run prisma:generate     # Generate client after schema changes
bun run prisma:migrate      # Run migrations (creates new migration)
bun run prisma:studio       # Open Prisma Studio GUI
```

**Testing Webhooks (Asaas Payment):**
```bash
bun run dev                 # Terminal 1: Start app
bun run ngrok               # Terminal 2: Tunnel to localhost:3000
# Configure webhook URL in Asaas dashboard with ngrok URL
```

## Critical Integration Points

**Supabase Auth:**
- Middleware (`middleware.ts`) validates sessions via `updateSession(request)`
- Protected routes: `/dashboard`, `/board`, `/pipeline`, `/manager-users`
- Public routes: `/`, `/sign-in`, `/sign-up`, `/subscribe`
- Role-based access: Manager vs Operator (check `middleware.ts` for managerOnlyRoutes)
- Server client: `lib/supabase/server.ts` with `createSupabaseServer()` (SSR) or `createSupabaseAdmin()` (admin ops)

**Asaas Payments:**
- Environment auto-detection: `ASAAS_ENV` → `NODE_ENV` → defaults to 'sandbox'
- Webhook endpoint: `/api/webhooks/asaas` (bypasses auth middleware - see middleware.ts line 18-20)
- Token validation: Header `asaas-access-token` must match `ASAAS_WEBHOOK_TOKEN` env var
- Key events: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED` (see `app/api/webhooks/asaas/route.ts`)
- Library config: `lib/asaas.ts` handles URL/key switching between sandbox/production

**URL Routing:**
- Dynamic supabaseId: Routes follow `app/[supabaseId]/[feature]/*` pattern
- Extract supabaseId: Always use `const params = useParams(); const supabaseId = params.supabaseId as string;`
- API routes: Always `/api/v1/[feature]` (not `/api/[feature]`)

## Project-Specific Rules

**NEVER:**
- Create implementation summary docs (`*_IMPLEMENTATION_SUMMARY.md`, `*_FIX_SUMMARY.md`)
- Put database queries in routes (use UseCases/Services)
- Skip Output return type in UseCases
- Use npm/yarn (use Bun)
- Hardcode URLs (use `process.env.NEXT_PUBLIC_APP_URL` or `getFullUrl()` from `lib/utils/app-url`)

**ALWAYS:**
- Search existing code before adding new patterns (inspect `app/api/useCases/` and `app/[supabaseId]/`)
- Use TypeScript with strict types (no `any` without good reason)
- Validate inputs in UseCases, return `Output(false, [], ['error message'], null)`
- Use `console.info` for flow logs, `console.error` for errors
- Add descriptive commits: `type(scope): description` with bullet points in body
- Check `.github/instructions/leads-flow-instructions.instructions.md` for detailed architecture guides

## Error Handling Patterns

**UseCase validation errors:**
```typescript
if (!data.required) {
  return new Output(false, [], ['Campo obrigatório não informado'], null);
}
```

**Unexpected errors:**
```typescript
catch (error) {
  console.error('[Context] Error message:', error);
  return new Output(false, [], ['Erro interno do servidor'], null);
}
```

**Frontend service errors:**
```typescript
const result = await response.json();
if (!result.isValid) {
  throw new Error(result.errorMessages.join(', '));
}
```

## Reference Examples

**Complete UseCase:** `app/api/useCases/metrics/MetricsUseCase.ts`  
**Frontend Context (SOLID):** `app/[supabaseId]/dashboard/features/context/`  
**Webhook Handler:** `app/api/webhooks/asaas/route.ts`  
**Output Type:** `lib/output/index.ts`  
**Auth Middleware:** `middleware.ts`  
**Asaas Config:** `lib/asaas.ts`  

## Environment Variables

See `.env.example` or `README.md` for full list. Critical ones:
- `DATABASE_URL`, `DIRECT_URL` (Prisma)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL`

## Documentation

Extensive guides in `/docs/`:
- Architecture: `ARCHITECTURE_GUIDE.md`, `.github/instructions/leads-flow-instructions.instructions.md`
- Quick start: `QUICK_START.md`
- Asaas: `ASAAS_CONFIGURATION.md`, `WEBHOOK_SETUP.md`
- Deployment: `VERCEL_DEPLOYMENT.md`

Before making changes, consult similar existing code and list files you plan to modify. Ask about credentials/environment specifics when needed for testing.
