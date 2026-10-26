---
applyTo: '**'
---
# Lead Flow — Project index

Lead Flow (Corretor Studio) is a SaaS platform for Brazilian health-insurance brokerages. It manages teams, leads, sales pipelines, schedules, subscriptions and operational integrations. Product claims, audience, pricing and tone come from `PRODUCT.md` and the current product/data sources; do not copy volatile values into implementation instructions.

## Stable stack

- Next.js App Router, strict TypeScript and Node runtime.
- Bun is the package manager and local script runner.
- PostgreSQL/Supabase with Prisma as ORM.
- Supabase Auth, Resend, Asaas and Google Calendar integrations.
- Tailwind CSS and shadcn/ui; visual tokens live in `DESIGN.md`.

## Canonical sources

| Need | Read |
|---|---|
| Universal governance and context routing | `agents.md` |
| Product, audience, copy and current commercial facts | `PRODUCT.md` and product-specific source files |
| UI tokens and visual direction | `DESIGN.md` |
| Models, enums and physical database names | `prisma/schema.prisma` |
| Backend structure | `app/api` and `.governance/ai/backend.md` |
| Frontend structure | relevant `app/**/features` and `.governance/ai/frontend.md` |
| Database/migrations | `supabase/migrations`, Prisma schema and `.governance/ai/database.md` |
| Tests and visual verification | `e2e`, test files and `.governance/ai/testing.md` |
| Radar | `RADAR_SPEC.md` and current Radar source files |
| Legacy exceptions | `.governance/ai-governance.config.json` |

Inspect only sources relevant to the requested change. Source code and schemas override stale prose. Never infer current prices, feature availability, routes, fields or limits from this index.
