---
applyTo: '**'
---
# Lead Flow — Contexto Completo do Projeto

> Arquivo de contexto gerado para auxiliar IAs na compreensão rápida e profunda do projeto.
> Atualizar este arquivo sempre que houver mudanças significativas de stack, design, schema ou arquitetura.

---

## Visão Geral

**Lead Flow** é uma plataforma SaaS de gestão de leads para corretores de planos de saúde.
Permite que **managers** cadastrem times, incluam **operators** (SDR/CLOSER), gerenciem leads ao longo de um funil de vendas, integrem com Google Calendar para agendamento e com Asaas para cobrança de assinaturas.

**Modelo de negócio:**
- Plano base do manager: R$ 59,90/mês
- Custo adicional por operator: R$ 19,90/mês
- Período de trial gratuito
- Cobrança via Asaas (PIX e cartão)

---

## Stack Técnica

| Camada          | Tecnologia                                      |
|-----------------|------------------------------------------------|
| Framework       | Next.js 15 (App Router)                        |
| Linguagem       | TypeScript 5 (strict, obrigatório)             |
| Runtime         | Node.js 24+                                    |
| Package manager | **Bun** (NUNCA npm ou yarn)                    |
| Estilização     | Tailwind CSS 4 + CSS Variables (OKLch)         |
| UI Components   | shadcn/ui (Radix UI base)                      |
| Ícones          | Lucide React + Tabler Icons                    |
| Formulários     | React Hook Form + Zod                          |
| Tabelas         | TanStack React Table v8                        |
| Drag & Drop     | @dnd-kit + @hello-pangea/dnd                   |
| Gráficos        | Recharts 2                                     |
| Animações       | Framer Motion 12 + tailwindcss-animate         |
| Datas           | date-fns 4 + react-day-picker                  |
| Toasts          | Sonner                                         |
| Temas           | next-themes (dark/light via classe CSS)        |
| ORM             | Prisma 6 (PostgreSQL adapter)                  |
| Banco de dados  | PostgreSQL via Supabase                        |
| Auth            | Supabase Auth (JWT, SSR)                       |
| Email           | Resend                                         |
| Pagamentos      | Asaas (PIX + cartão, mercado brasileiro)       |
| Calendário      | Google Calendar API (OAuth)                    |
| Real-time       | Supabase Realtime                              |
| Storage         | Supabase Storage                               |
| Analytics       | Vercel Analytics                               |

---

## Design System

### Cores (CSS Variables — OKLch)

| Token              | Valor Light                        | Valor Dark                         |
|--------------------|------------------------------------|------------------------------------|
| `--primary`        | `#ff6900` (laranja)                | `#f54900`                          |
| `--secondary`      | oklch(0.967 0.001 286.375)         | neutro escuro                      |
| `--accent`         | oklch(0.967 0.001 286.375)         | ajustado no dark                   |
| `--destructive`    | oklch(0.577 0.245 27.325) (vermelho)| ajustado no dark                  |
| `--background`     | branco                             | escuro profundo                    |
| `--foreground`     | escuro                             | claro                              |
| `--chart-1..5`     | 5 cores OKLch para gráficos        | variantes dark                     |
| `--sidebar-*`      | tokens neutros para sidebar        | ajustados no dark                  |

**Cor primária da marca: laranja `#ff6900`** — usar para CTAs, highlights, elementos ativos.

### Tipografia

| Contexto         | Fonte     | Pesos         |
|------------------|-----------|---------------|
| App (padrão)     | Poppins   | 400, 500, 600, 700 |
| Landing page     | Inter     | variados      |

### Espaçamento & Raio

- `--radius`: `0.65rem` (base)
- Variantes: `sm` (base-4px), `md` (base-2px), `lg` (base), `xl` (base+4px)
- Container: max-width `1400px`, padding `2rem`

### Scrollbars Customizadas

- `.kanban-scrollbar` — board/kanban (oculta até hover)
- `.activity-scrollbar` — feeds de atividade
- `.dialog-scrollbar` — conteúdo de modais

### Dark Mode

- Implementado via `next-themes` com `darkMode: "class"` no Tailwind
- Variáveis CSS redefinem todos os tokens no seletor `.dark`

---

## Arquitetura Backend

### Fluxo de camadas

```
Route (HTTP) → UseCase (Business) → [Service (Domain)] → Prisma (Data)
```

### Estrutura de pastas (`app/api/`)

```
app/api/
  v1/                           # Endpoints de produto (versionados)
    [domain]/
      route.ts                  # HTTP root/collection
      [param]/
        route.ts                # HTTP parametrizado
      DTO/                      # Contratos de transporte (opcional)
  useCases/
    [domain]/
      I[Feature]UseCase.ts      # Contrato do use case
      [Feature]UseCase.ts       # Orquestração + Output
  services/
    [Feature]/
      I[Feature]Service.ts      # Contrato do service
      [Feature]Service.ts       # Implementação
  infra/
    data/
      prisma.ts                 # Boundary do Prisma (ÚNICO ponto de acesso)
      repositories/             # Repository helpers (quando necessário)
  auth/                         # Endpoints de autenticação
  email/                        # Integração de email
  webhooks/                     # Receptores de webhook (Asaas, etc.)
  demo/                         # Endpoints não-produto
```

### Output Contract (OBRIGATÓRIO para novos UseCases)

```typescript
import { Output } from 'lib/output/index.ts'

return new Output(
  isValid: boolean,
  successMessages: string[],
  errorMessages: string[],
  result: unknown
)
```

Routes mapeiam `result.isValid` para status HTTP.

### Regras de Route

- Apenas HTTP: parse request → chamar use case → mapear status code
- NUNCA chamar Prisma diretamente (para código novo)
- Log de rota: `[NomeRotaStável][MÉTODO]` (ex: `[LeadsRoute][GET]`)
- Usar `console.info` para fluxo, `console.error` para erros

### Domínios de API existentes (`/api/v1/`)

`auth`, `leads`, `operators`, `subscriptions`, `teams`, `profiles`, `dashboard`, `calendar`, `billing`, `notifications`, `health-plans`, `checkout`, `meta`, `support`

---

## Arquitetura Frontend

### Fluxo de camadas

```
page.tsx → features/context → features/services → backend
page.tsx → features/container → features/context
```

### Estrutura de pastas (por página)

```
app/[supabaseId]/[feature]/
  page.tsx                          # Thin entrypoint (provider + layout)
  loading.tsx                       # Loading UI da rota
  features/
    context/
      [Feature]Types.ts             # State, actions, contratos locais
      [Feature]Hook.ts              # Orquestração e estado
      [Feature]Context.tsx          # Provider + consumer hook
    services/
      I[Feature]Service.ts          # Contrato do serviço
      [Feature]Service.ts           # Comunicação com backend
    container/
      [Feature]Container.tsx        # Composição principal da página
    components/                     # Subcomponentes apresentacionais (opcional)
    types/                          # Tipos compartilhados da feature (opcional)
    validation/                     # Schemas Zod / validadores (opcional)
    hooks/                          # Hooks extras da feature (opcional)
    utils/                          # Helpers puros (opcional)
```

### Rotas frontend (tenant-aware: `app/[supabaseId]/`)

| Rota               | Descrição                               |
|--------------------|----------------------------------------|
| `/dashboard`       | Métricas e visão geral                 |
| `/crm`             | Gestão de leads (tabela)               |
| `/board`           | Kanban de leads por status             |
| `/pipeline`        | Pipeline de vendas                     |
| `/calendar`        | Integração Google Calendar             |
| `/teams`           | Gerenciamento de times                 |
| `/manager-users`   | Gestão de managers (admin)             |
| `/notifications`   | Central de notificações                |
| `/account`         | Configurações da conta                 |
| `/subscription`    | Gerenciamento de assinatura            |

### Roteamento (middleware.ts)

- **Protegidas**: `/dashboard`, `/account`, `/crm`, `/board`, `/pipeline`, `/manager-users`, `/notifications`
- **Públicas**: `/`, `/sign-in`, `/sign-up`, `/subscribe`, `/checkout-return`, `/operator-confirmed`, `/pix-confirmed`, `/set-password`, `/forgot-password`

---

## Schema do Banco de Dados

### Modelos principais

#### Profile (Usuário)
- Estende `auth.users` do Supabase via `supabaseId` (1:1)
- `role`: `manager` | `backoffice` | `operator`
- `function`: `SDR` | `CLOSER`
- Hierarquia: Manager → Operator (auto-relação)
- Campos de Google Calendar (OAuth tokens)
- Campos de assinatura Asaas
- `activeTeamId` para multi-time

#### Lead
- Dados do lead: name, email, phone, CNPJ, age
- Plano de saúde: currentHealthPlan, soldPlan, currentValue
- Reunião: meetingDate, meetingTitle, meetingNotes, meetingLink, meetingHeald
- `status` (12 valores): `new_opportunity` → `contract_finalized`
- Financeiro: ticket, contractDueDate
- Relações: manager, team, assignee (operator), closer, creator, updater
- Unique por time: email + CNPJ

**Status do lead (em ordem):**
`new_opportunity`, `contacted`, `qualified`, `proposal_sent`, `negotiation`, `proposal_pending`, `approved`, `contract_sent`, `awaiting_signature`, `contract_signed`, `payment_pending`, `contract_finalized`

#### LeadsSchedule
- Agendamento de reuniões com sync Google Calendar
- `inviteDispatchStatus`: `sent_google` | `sent_resend` | `failed`

#### LeadActivity / LeadActivityReaction
- Types: `note`, `call`, `whatsapp`, `email`, `status_change`
- Reações com emoji unificado

#### Team / TeamMember
- Multi-tenancy: Manager → Team → Lead
- `isDefault` flag
- Papéis por membro

#### Notification
- Types: `ACTIVITY_MENTION`, `ACTIVITY_REACTION`, `TEAM_MEMBER_ADDED`, `TEAM_MEMBER_REMOVED`, `LEAD_SCHEDULE_CREATED`, `LEAD_PROPOSAL_PENDING`
- Status de leitura

#### Subscription
- `SubscriptionStatus`: `trial`, `active`, `past_due`, `suspended`, `canceled`
- `SubscriptionPlan`: `free_trial`, `manager_base` (R$59,90), `with_operators` (R$59,90 + R$19,90/operator)

---

## Integrações Críticas

### Supabase Auth
- Middleware: `middleware.ts` via `updateSession(request)`
- `x-supabase-user-id` header propagado para rotas de API

### Asaas (Pagamentos)
- Webhook: `app/api/webhooks/asaas/route.ts`
- Header obrigatório: `asaas-access-token` == `ASAAS_WEBHOOK_TOKEN`
- Serviços: `AsaasCustomer`, `AsaasOperator`, `AsaasSubscription`
- Handler de eventos: `PaymentValidationService.ts`

### Google Calendar
- OAuth flow + refresh de tokens
- Criação de eventos via `LeadsSchedule`
- Campos OAuth no `Profile`

### Resend (Email)
- Convites de reunião e notificações transacionais

---

## Padrões e Convenções

### Nomenclatura
- UseCase: `[Feature]UseCase.ts` + `I[Feature]UseCase.ts`
- Service: `[Feature]Service.ts` + `I[Feature]Service.ts`
- Sempre interface + implementação concreta

### TypeScript
- Strict mode obrigatório
- Sem `any` implícito
- Sem JavaScript (apenas `.ts`/`.tsx`)

### Requests / Effects
- Effects de data-fetching devem ser idempotentes
- Deduplicação com: chave estável + in-flight guard + last-success guard
- Nunca depender de identidades instáveis (funções/objetos que recriam a cada render)

### Botões de ação
- Mutations (`POST`, `PUT`, `PATCH`, `DELETE`) devem travar no primeiro clique
- Loading imediato + botão desabilitado durante request + unlock no `finally`

### Logging
- `console.info` para logs de fluxo
- `console.error` para erros
- Rotas identificadas por nome estável: `[NomeRota][MÉTODO]`

### URLs
- NUNCA hardcodar URLs
- Usar `NEXT_PUBLIC_APP_URL` ou `getFullUrl()`

---

## Componentes UI Globais

### `components/ui/` (shadcn/ui)
Alert, Avatar, Badge, Button, Calendar, Card, Checkbox, Command, DateTimePicker, Dialog, Drawer, Dropdown, Form, Input, Label, Popover, Radio, ScrollArea, Select, Separator, Sheet, Switch, Tabs, Toggle, Tooltip e outros.

**Regra**: SEMPRE preferir composição de componentes shadcn/ui existentes antes de criar markup custom.
Para novos componentes visuais: iniciar pelo workflow shadcn (`bunx --bun shadcn@latest add <component>`).

### Hooks Compartilhados (`hooks/`)
`useLeads`, `useLeadActivitiesRealtime`, `usePaymentPolling`, `useTeamMembersByFunction`, `useHealthPlans`, `useForms`, `useUserRole`, `use-mobile`

---

## Comandos Essenciais

```bash
# Desenvolvimento
bun dev

# Type check
bun run typecheck

# Lint
bun run lint

# Governance (obrigatório antes de PR)
bun run governance:check

# Sync adapters de IA (após mudar agents.md)
bun run governance:sync

# Scaffold nova feature
bun run scaffold:feature -- --name <feature-name>

# Prisma / Supabase migrations
bun run db:migrate:from-prisma -- <name>   # schema.prisma → SQL em supabase/migrations/
bun run db:migrate:new <name>              # SQL manual (RLS, seeds, triggers)
bun run db:migrate:reset:local
bun run prisma:seed
bunx prisma studio
```

---

## Variáveis de Ambiente

### Validação Automática

O projeto utiliza validação automática de variáveis de ambiente em **build time** e **runtime**:

- **Build time**: `next.config.ts` valida todas as variáveis antes do build
- **Runtime**: `instrumentation.ts` valida na inicialização do servidor
- **Schema**: Zod schema em `lib/env/validation.ts` define formatos esperados
- **Acesso type-safe**: `lib/env/EnvService.ts` fornece variáveis validadas e tipadas

**Como usar:**
```typescript
import { getValidatedEnv } from '@/lib/env';

const env = getValidatedEnv();
console.log(env.NEXT_PUBLIC_APP_URL); // Type-safe!
```

**Adicionar nova variável:**
1. Adicionar ao `.env.example` com valor de exemplo
2. Adicionar ao schema em `lib/env/validation.ts`
3. Se crítica, adicionar ao array `CRITICAL_ENV_VARS`

### Variáveis Críticas

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ASAAS_API_KEY=
ASAAS_ENV=
ASAAS_WEBHOOK_TOKEN=
ENCRYPTION_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

**Formato esperado:**
- URLs: devem começar com `http://` ou `https://`
- API Keys Asaas: devem começar com `aact_`
- API Keys Resend: devem começar com `re_`
- Encryption keys: 64 caracteres hexadecimais (gerar com `openssl rand -hex 32`)
- Database URLs: devem começar com `postgresql://`
- Email addresses: formato válido de email
- `ASAAS_ENV`: `sandbox` ou `production`

---

## Governança e CI

- Arquivo canônico de regras: `agents.md`
- Adapters gerados (NÃO editar manualmente): `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/lead-flow-agents.mdc`
- Exceções legadas: `.governance/ai-governance.config.json`
- CI falha se `bun run governance:check` falhar
- Todo PR deve passar pelo checklist em `agents.md`

---

## Módulo Radar

O módulo Radar é um add-on (`FEATURE_SLUGS.RADAR = "radar"`) que unifica dados de clientes vindos do CRM, carteira, listas de contatos de e-mail e WhatsApp em perfis team-scoped para campanhas de e-mail.

### Modelos Prisma

- `RadarProfile` — perfil unificado por cliente dentro de um time
- `RadarIdentity` — identidades normalizadas (lead_id, email, phone, document, whatsapp)
- `RadarSourceLink` — vínculos de origem (crm_lead, portfolio, email_contact, whatsapp_contact)
- `RadarEvent` — timeline de eventos por canal (email.*, whatsapp.*)
- `RadarChannelConsent` — consentimento por canal (email, whatsapp)

Tabelas físicas: `corretor_studio_radar_profiles`, `corretor_studio_radar_identities`, etc.

### Paths canônicos

- API: `app/api/v1/radar/**` (sync, profiles, segments, available-fields, interpolation-preview)
- Repositório: `app/api/infra/data/repositories/radar/RadarRepository.ts`
- Service: `app/api/services/radar/RadarService.ts`
- UseCase: `app/api/useCases/radar/RadarUseCase.ts`
- Lib: `lib/radar/**` (normalization, segment-config, segment-rules, field-catalog, resolve-field-value, enrich-campaign-recipients, etc.)
- Frontend: `app/[supabaseId]/radar/**` (RadarContainer, RadarContext, useRadarHook, RadarService)

### RBAC

- Autenticação via `getRadarAccess()` (`app/api/v1/radar/utils/getRadarAccess.ts`)
- Exige `isManagerOrMaster` + add-on `FEATURE_SLUGS.RADAR` ativo para o time
- Validação local: `teamHasRadarFeature(teamId)` em `lib/radar/team-has-radar-feature.ts`

### Limites de disparo

- **2.000 perfis/dia** por time via segmento Radar
- **≤ 2.000 por campanha** de segmento Radar (campanhas maiores devem usar lista de contatos com sub-campanhas)
- Constante: `EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB` em `lib/email/campaign-limits.ts`

---

## Postman

- Collection: `postman/Lead-Flow-API-Collection.json`
- Environment: `postman/Lead-Flow-Environment.json`
- **Atualizar ao criar novos endpoints** (obrigatório)
