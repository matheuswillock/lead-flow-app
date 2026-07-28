# Spec: Webhooks Entrada / Saída — Tasks

**Status:** ready for implementation  
**Depends on:** [requirements.md](./requirements.md), [design.md](./design.md)

## Implementation strategy

1. Security-first: SSRF guard, token hashing, HTTPS-only targets.
2. Schema + data migration before UI.
3. Outbox + cron before ligar publishers nos UseCases do CRM.
4. Frontend segregado Entrada/Saída por último (hub → listas → create/detail).
5. Qualidade contínua: após cada lote de código, rodar a checklist de validação.

## Quality checkpoints (obrigatório após edições)

```bash
bun run typecheck 2>&1 | head -20
bun run lint
bun run governance:check
bun run lint:pt-br
# após mudanças de UI:
bun run design:check
```

## Phase 0 — Prep

- [ ] **T0.1** Criar branch `feature/webhooks-inbound-outbound` a partir da base acordada (não `main`/`develop` direto).
- [ ] **T0.2** Releer `agents.md` + `.github/instructions/project-context.instructions.md`.
- [ ] **T0.3** Confirmar local Supabase (porta 55322) disponível para `db:migrate:from-prisma`.

## Phase 1 — Schema & migrations

- [ ] **T1.1** Adicionar enums e models em `prisma/schema.prisma`:
  - `TeamWebhookDirection`, `TeamWebhookStatus`, `TeamWebhookDestinationPreset`, `TeamWebhookEventKey`, `TeamWebhookLogResult`, `TeamWebhookOutboxStatus`
  - Models `TeamWebhook`, `TeamWebhookEventLog`, `TeamWebhookOutbox`
  - Relações em `Team` / `Profile`
  - `NotificationType.WEBHOOK_AUTO_PAUSED`
- [ ] **T1.2** Gerar migration schema: `bun run db:migrate:from-prisma -- team-webhooks` (revisar SQL; **não** push remoto sem autorização).
- [ ] **T1.3** Migration manual de dados: `bun run db:migrate:new migrate-studio-webhook-to-team-webhook`
  - Copiar `TeamStudioWebhookConfig` → `TeamWebhook` inbound
  - Copiar logs recentes (melhor esforço)
  - Idempotente (`ON CONFLICT` / checks)
- [ ] **T1.4** Validar local: `bun run db:migrate:reset:local` (ou apply local) + `prisma generate`.
- [ ] **T1.5** Atualizar seed se necessário (não é featureSlug novo; confirmar `integration` já cobre).
- [x] **T1.6** Migration RLS: `bun run db:migrate:new team-webhooks-rls`
  - ENABLE RLS em `corretor_studio_team_webhooks`, `_event_logs`, `_outbox`
  - Policies manager-only (CRUD webhooks; SELECT logs; outbox sem policy authenticated)
  - Grants: revoke anon; authenticated conforme matriz; service_role ALL
  - **Não** push remoto sem autorização do owner

**Checkpoint:** typecheck após `prisma generate`.

## Phase 2 — Security & delivery primitives

- [ ] **T2.1** Generalizar `lib/webhooks/studioWebhookSecurity.ts` → `lib/webhooks/teamWebhookSecurity.ts` (manter re-exports legados).
- [ ] **T2.2** Implementar `WebhookHttpDeliveryService` + guard SSRF (block private IPs) + timeout 10s.
- [ ] **T2.3** Implementar `webhookPayloadPresets.ts` (generic, slack, teams, zapier wrappers).
- [ ] **T2.4** Testes unitários: URL guard, presets, threshold auto-pause helper.

**Checkpoint:** lint + typecheck.

## Phase 3 — Repositories

- [ ] **T3.1** `TeamWebhookRepository` com variantes `WithCtx` (list, find, create, update, setStatus, findActiveOutboundForEvent).
- [ ] **T3.2** `TeamWebhookEventLogRepository` (append, list paginated, filters).
- [ ] **T3.3** `TeamWebhookOutboxRepository` (enqueue, claimDue, mark delivered/failed/cancelled).
- [ ] **T3.4** Preferir `select` sobre `include`; índices usados nas queries de listagem.

**Checkpoint:** typecheck.

## Phase 4 — Services & UseCases (gestão)

- [ ] **T4.1** `TeamWebhookService` — CRUD, validação Zod (URL HTTPS, ≥1 event outbound, token modes inbound).
- [ ] **T4.2** `TeamWebhookUseCase` retornando `Output`.
- [ ] **T4.3** Rotas:
  - `GET/POST /api/v1/integrations/webhooks`
  - `GET/PATCH/DELETE /api/v1/integrations/webhooks/[id]`
  - `POST /api/v1/integrations/webhooks/[id]/status`
  - `GET /api/v1/integrations/webhooks/[id]/logs`
  - `POST /api/v1/integrations/webhooks/[id]/test`
- [ ] **T4.4** Auth: `getTeamAccess()` → `TeamContext` uma vez; manager + feature `CONFIGURATION`.
- [ ] **T4.5** Wrappers legados `studio-webhook` → proxy para inbound default (compat 1 release).

**Checkpoint:** typecheck, lint, governance.

## Phase 5 — Inbound ingestion cutover

- [ ] **T5.1** Atualizar `handleStudioWebhookLeadRequest` para resolver `TeamWebhook` inbound ativo + token.
- [ ] **T5.2** Respeitar `disabled`/`paused` → 403 + log `rejected`.
- [ ] **T5.3** Persistir logs em `TeamWebhookEventLog` (manter escrita dual no legado só se rollback necessário; preferir cutover limpo).
- [ ] **T5.4** Smoke: POST válido cria lead; token inválido 401; webhook disabled 403.

**Checkpoint:** typecheck + teste manual ingestão.

## Phase 6 — Outbound pipeline

- [ ] **T6.1** `OutboundEventPublisher` — encontra webhooks ativos matching event → enqueue outbox.
- [ ] **T6.2** `ProcessWebhookOutboxUseCase` — claim, deliver, log, streak, auto-pause, notificação.
- [ ] **T6.3** Cron route `POST /api/v1/integrations/webhooks/cron/process-outbox` com `CRON_SECRET`.
- [ ] **T6.4** Registrar cron em `vercel.json` (ou equivalente do projeto) se houver padrão.
- [ ] **T6.5** Backoff outbox + cancelamento quando webhook pausa/desativa.
- [ ] **T6.6** Testes unitários do publisher (filtro eventos/status) e do auto-pause.

**Checkpoint:** typecheck, lint.

## Phase 7 — Domain event hooks

- [ ] **T7.1** `lead_created` — após criação em `LeadUseCase` (e inbound create, se desejado evitar loop: inbound **não** re-dispara outbound do mesmo lead? **Decisão:** inbound **pode** disparar `lead_created` outbound — documentar; se ruído, flag `source !== studio_webhook` — **default: dispara sim**).
- [ ] **T7.2** `lead_status_changed` — transição de status.
- [ ] **T7.3** `lead_assigned` — atribuição.
- [ ] **T7.4** `appointment_created` — `LeadScheduleService` / equivalente.
- [ ] **T7.5** `appointment_reminder` — no caminho do lembrete existente.
- [ ] **T7.6** `activity_created` — criação de activity (excluir tipos internos de sistema se necessário).
- [ ] **T7.7** Garantir publisher nunca quebra a request do CRM (`try/catch` + `console.error`).

**Checkpoint:** typecheck; smoke 1 evento → outbox row.

## Phase 8 — Frontend hub & pages

- [ ] **T8.1** Design brief (`corretor-studio-design` skill) + `DESIGN.md` tokens.
- [ ] **T8.2** Atualizar hub `/{supabaseId}/integrations`: cards Entrada / Saída (+ Lead Form existente).
- [ ] **T8.3** Feature structure:
  - `integrations/webhooks/...` pages
  - `features/context|services|container|components` (interface + service HTTP)
- [ ] **T8.4** Listagem inbound + outbound com badges de status.
- [ ] **T8.5** Create inbound (`/inbound/new`) — token modes + expiry.
- [ ] **T8.6** Detail inbound — tabs Config / Logs; copy URL; status actions.
- [ ] **T8.7** Create outbound — preset selector, URL, multi-select eventos, threshold.
- [ ] **T8.8** Detail outbound — tabs Config / Logs; Testar envio; Reativar se paused.
- [ ] **T8.9** Remover/ocultar card monolítico `StudioWebhookIntegration` (redirect para nova listagem).
- [ ] **T8.10** shadcn: Badge, Tabs, FieldGroup, Skeleton, AlertDialog, sonner; `lint:pt-br` + `design:check`.

**Checkpoint:** typecheck, lint, governance, lint:pt-br, design:check.

## Phase 9 — Docs & Postman

- [ ] **T9.1** Atualizar `docs/WEBHOOK_SETUP.md` (entrada + saída + presets).
- [ ] **T9.2** Atualizar `postman/Lead-Flow-API-Collection.json` e Environment.
- [ ] **T9.3** Nota de breaking changes: nenhuma na URL pública; UI de gestão muda.

## Phase 10 — Hardening & cleanup

- [ ] **T10.1** Job/documentar retenção de logs (90 dias) — implementar purge cron se tempo permitir; senão ticket follow-up.
- [ ] **T10.2** Limite máximo outbound por time (sugestão 20) enforced no create.
- [ ] **T10.3** Remover código morto do card legado após validação.
- [ ] **T10.4** Revisar allowlists de governance — não adicionar exceções novas.
- [ ] **T10.5** PR checklist `agents.md` completa.

## Manual test plan

### Inbound

1. Criar webhook de entrada → copiar URL → POST com `name/email/phone` → lead criado + log success.
2. Desativar → POST → 403 + log rejected.
3. Token inválido → 401 + log.
4. URL legado `/api/webhooks/studio/{teamId}/{token}` funciona pós-migração.

### Outbound

1. Criar outbound Slack preset com só `lead_created` → criar lead → outbox → delivery (webhook.site) → log success.
2. Evento `lead_status_changed` **não** selecionado → mudança de status **não** enfileira.
3. Forçar falhas (URL inválida) ×10 → status `paused` + notificação manager.
4. Reativar → streak 0 → novo evento entrega.
5. Testar envio no detalhe → log de teste.

### UX

1. Hub deixa claro Entrada vs Saída.
2. Badges de status em lista e detalhe.
3. Logs paginados >15 itens.

## Risk register

| Risco | Mitigação |
|-------|-----------|
| SSRF via targetUrl | Allow HTTPS + block private ranges |
| Volume de outbox | Claim batch limitado no cron; índices |
| Loop inbound→outbound | Aceito na v1; monitorar; filtro opcional depois |
| Migração token | Reusar hash/cipher existentes; não regenerar token sem ação do user |
| Cron não roda em dev | Documentar curl local com `CRON_SECRET` |
| Quebra UI antiga | Proxy API legado + redirect visual |

## Effort guide (aproximado)

| Phase | Effort |
|-------|--------|
| 1 Schema | 0.5–1d |
| 2–3 Primitives/Repos | 1d |
| 4 Gestão API | 1d |
| 5 Inbound cutover | 0.5d |
| 6–7 Outbound + hooks | 1.5–2d |
| 8 Frontend | 2d |
| 9–10 Docs/hardening | 0.5d |
| **Total** | **~7–8d** |

## Definition of Done

- Todos os acceptance criteria de [requirements.md](./requirements.md) marcáveis.
- APIs e UI segregadas por direção.
- Auto-pause + notificação funcionando.
- URL legado intacta.
- Validação automatizada verde.
- PR com checklist de `agents.md`.

## Tracking note

Fonte de verdade no repo: este `tasks.md`. Espelho Notion (spec-to-implementation) é opcional e não bloqueia o início da implementação.
