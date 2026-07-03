# Auditoria de Testes Backend — Inventário

**Data:** 2026-07-02  
**Escopo:** Inventário somente leitura de todos os arquivos `*.test.ts` relevantes ao backend e utilitários compartilhados.

---

## Legenda de qualidade

| Classificação | Significado |
|---------------|-------------|
| **Real** | Testa comportamento de produção importado; assertions significativas; falharia se a lógica quebrasse |
| **Parcial** | Cobre parte do módulo ou cenários limitados; útil mas incompleto |
| **Smoke** | Só verifica existência de API (métodos, tipos); não valida comportamento |
| **Débito** | Lógica duplicada no teste em vez de importar produção; ou patch frágil de prototype |

---

## Infraestrutura de testes

| Item | Valor |
|------|-------|
| Runner | Bun nativo (`bun:test`) |
| Config dedicada | Nenhuma (`vitest.config`, `jest.config`, `bunfig.toml` ausentes) |
| Script `test` | Subset fixo: `app/api/useCases/leads/utils`, `lib/email`, `lib/cdp`, `lib/web-push`, `lib/proxy` |
| Script `test:proxy` | `proxy.test.ts` + `lib/proxy/route-access.test.ts` |
| Script `test:integration` | CDP com `CDP_INTEGRATION_TEST=1` + `DATABASE_URL` |
| CI | Apenas `bun run test:proxy` (com `continue-on-error: true` em feature/develop) |
| Coverage | Inexistente |
| Fixtures compartilhadas | Nenhuma — helpers inline por arquivo |

---

## `app/api` — 12 arquivos de teste

| Arquivo | O que valida | Qualidade | Observações |
|---------|--------------|-----------|-------------|
| [`app/api/useCases/leads/utils/resolveTransferSchedule.test.ts`](../../app/api/useCases/leads/utils/resolveTransferSchedule.test.ts) | Merge de `extraGuests`, validação de data/e-mail em transferência de lead | **Real** | Modelo ideal TDD — util puro, casos de erro e sucesso |
| [`app/api/useCases/resendWebhook/ResendWebhookUseCase.test.ts`](../../app/api/useCases/resendWebhook/ResendWebhookUseCase.test.ts) | Delegação de eventos `domain.*` para `ResendDomainWebhookUseCase` | **Parcial** | Patch de `prototype.handle` — funcional mas frágil; preferir injeção de dependência |
| [`app/api/useCases/resendWebhook/ResendDomainWebhookUseCase.test.ts`](../../app/api/useCases/resendWebhook/ResendDomainWebhookUseCase.test.ts) | Processamento `domain.updated` com repositório stub | **Real** | Stub manual de `IEmailTeamDomainEventRepository` — padrão recomendado para UseCases |
| [`app/api/useCases/email/EmailAnalyticsUseCase.test.ts`](../../app/api/useCases/email/EmailAnalyticsUseCase.test.ts) | Existência de `getAnalytics` e `getDispatchPreview` | **Smoke** | Não valida Output, queries ou regras de negócio |
| [`app/api/useCases/associateProposal/AssociateBackofficeAccessUseCase.test.ts`](../../app/api/useCases/associateProposal/AssociateBackofficeAccessUseCase.test.ts) | Existência de `resolve` | **Smoke** | Matriz de autorização documentada no nome do describe, mas não testada |
| [`app/api/useCases/teamMembers/TeamMembersAssociatePrivacy.test.ts`](../../app/api/useCases/teamMembers/TeamMembersAssociatePrivacy.test.ts) | Filtro de sponsor em lista de membros | **Débito** | Função `filterSponsorFromMembers` definida **no teste**, não importada de produção |
| [`app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService.test.ts`](../../app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService.test.ts) | `parseResendBatchSendItems` — SDK v6 vs payload aninhado | **Real** | Testa função pura exportada; não cobre dispatch completo |
| [`app/api/services/associateProposal/AssociateProposalService.test.ts`](../../app/api/services/associateProposal/AssociateProposalService.test.ts) | Gate de documentos removido; helper `hasPendingRequiredDocuments` | **Parcial** | Primeiro caso real; segundo é smoke com `.catch(() => false)` |
| [`app/api/services/backofficeBot/BotPolicyService.test.ts`](../../app/api/services/backofficeBot/BotPolicyService.test.ts) | Políticas de nota e agendamento por role/função | **Real** | Helper `buildAccess` inline; cobertura sólida de regras puras |
| [`app/api/services/whatsapp/evo/EvoApiService.adopt.test.ts`](../../app/api/services/whatsapp/evo/EvoApiService.adopt.test.ts) | Detecção erro "already in use"; fluxo `adoptOrCreateInstance` | **Real** | Mock de `globalThis.fetch`; padrão para integrações HTTP |
| [`app/api/shared/billing/memberProBillingRules.test.ts`](../../app/api/shared/billing/memberProBillingRules.test.ts) | `resolveMemberProBypass`, totais em `buildBillingSummary` | **Real** | Regras puras de billing — alto ROI para TDD |
| [`app/api/v1/cdp/utils/getCdpAccess.test.ts`](../../app/api/v1/cdp/utils/getCdpAccess.test.ts) | Autorização CDP: 401, 403 por role, feature access | **Real** | Spy em `getTeamAccess` e `featureAccessUseCase`; modelo para helpers de route |

---

## `lib/` — 15 arquivos de teste (backend-relevante)

| Arquivo | O que valida | Qualidade |
|---------|--------------|-----------|
| [`lib/cdp/segment-rules.test.ts`](../../lib/cdp/segment-rules.test.ts) | Regras de segmentação (opened/clicked/window) | **Real** |
| [`lib/cdp/normalization.test.ts`](../../lib/cdp/normalization.test.ts) | Normalização phone/email/document/name | **Real** |
| [`lib/cdp/resolve-field-value.test.ts`](../../lib/cdp/resolve-field-value.test.ts) | Resolução de campos CDP por perfil | **Real** |
| [`lib/cdp/field-catalog.test.ts`](../../lib/cdp/field-catalog.test.ts) | Prioridade de segmentos primários | **Real** |
| [`lib/cdp/enrich-campaign-recipients.test.ts`](../../lib/cdp/enrich-campaign-recipients.test.ts) | Enriquecimento de destinatários com mocks de repo | **Real** |
| [`lib/cdp/customer-data-platform.integration.test.ts`](../../lib/cdp/customer-data-platform.integration.test.ts) | Segmentos + Prisma local | **Real** (integration, opt-in) |
| [`lib/email/interpolate.test.ts`](../../lib/email/interpolate.test.ts) | Interpolação de templates, timezone, tokens | **Real** |
| [`lib/email/map-resend-domain-error.test.ts`](../../lib/email/map-resend-domain-error.test.ts) | Mapeamento de erros Resend domain | **Real** |
| [`lib/web-push/parse-push-payload.test.ts`](../../lib/web-push/parse-push-payload.test.ts) | Parse de payload push | **Real** |
| [`lib/web-push/resolve-user-error-message.test.ts`](../../lib/web-push/resolve-user-error-message.test.ts) | Mensagens de erro user-facing | **Real** |
| [`lib/proxy/route-access.test.ts`](../../lib/proxy/route-access.test.ts) | Helpers de rota (tenant, auth, roles, sensitive) | **Real** |
| [`lib/google/should-notify-google-connect.test.ts`](../../lib/google/should-notify-google-connect.test.ts) | Quando notificar conexão Google | **Real** |
| [`lib/security/lead-form-embed-headers.test.ts`](../../lib/security/lead-form-embed-headers.test.ts) | Headers CSP/X-Frame para embed de formulário | **Real** |

**Subpastas `lib/` sem nenhum teste:** `account`, `backoffice-adhesions`, `billing`, `bootstrap`, `cache`, `dates`, `env`, `features`, `http`, `notifications`, `output`, `services`, `studio-bot`, `subscription`, `supabase`, `validations`, `webhooks`, `whatsapp`, entre outras.

---

## Raiz e middleware

| Arquivo | O que valida | Qualidade |
|---------|--------------|-----------|
| [`proxy.test.ts`](../../proxy.test.ts) | Middleware Next.js: rotas públicas, auth, tenant UUID, backoffice, headers | **Real** | Único teste executado de forma consistente no CI |

---

## Frontend (fora do escopo backend, listado para completude)

| Arquivo | Nota |
|---------|------|
| `app/[supabaseId]/email/configuracoes/features/utils/resend-region-labels.test.ts` | Util frontend email |
| `app/[supabaseId]/email/templates/[id]/features/utils/analyze-email-html.test.ts` | Util frontend templates |

---

## Resumo quantitativo

| Área | Arquivos `.ts` (aprox.) | Arquivos `.test.ts` | Taxa |
|------|-------------------------|---------------------|------|
| `app/api/useCases` | ~208 | 6 | ~3% |
| `app/api/services` | ~139 | 4 | ~3% |
| `app/api/infra/repositories` | ~122 | 0 | 0% |
| `app/api/v1` (routes) | ~305 handlers | 0 routes (1 util) | ~0% |
| `app/api/webhooks` | ~14 | 0 routes (2 use cases Resend) | ~0% |
| `lib/` | ~174 | 15 | ~9% |
| **Total backend `app/api`** | **~500+** | **12** | **~2%** |

### Por qualidade (apenas `app/api`)

| Classificação | Quantidade |
|---------------|------------|
| Real | 7 |
| Parcial | 3 |
| Smoke | 2 |
| Débito | 1 |

---

## Débito técnico identificado nos testes existentes

1. **Smoke tests** — `EmailAnalyticsUseCase`, `AssociateBackofficeAccessUseCase`: não contar como cobertura de UseCase.
2. **Lógica duplicada** — `TeamMembersAssociatePrivacy.test.ts`: extrair filtro para módulo testável ou importar de `TeamMembersUseCase`/service.
3. **Patch de prototype** — `ResendWebhookUseCase.test.ts`: refatorar para DI quando possível.
4. **CI frágil** — suite completa não roda; `test:proxy` com `continue-on-error: true` mascara regressões.
5. **Subset fixo** — script `test` ignora a maioria dos testes existentes (ex.: Resend webhook, BotPolicy, billing rules).
