# BILLING_AUDIT.md — Auditoria unificada de billing

**Data da reauditoria:** 2026-07-24 (inventário de tabelas de assinatura ampliado na mesma data)  
**Fontes absorvidas:** `BILLING_ENGINE_AUDIT.md` (09/07/2026, removido) + audit 20/07  
**Método:** leitura de código e schema; inventário writers/readers das tabelas de assinatura. Consultas a produção (grants Supabase, Asaas prod) **não** reexecutadas — *pendente de confirmação em produção* onde indicado.  
**Nenhum código de produto foi alterado nesta rodada** (só documentação).

**Documentos relacionados:** `PRICING_MODEL.md` / `PRICING_TABLE.md`. SPEC canônica: `BILLING_SPEC.md` v2.0.

---

## Sumário executivo (status 2026-07-24)

| ID | Severidade | Achado | Status 24/07 |
|---|---|---|---|
| C1 | **Crítico** | `POST /api/v1/profiles/permanent-subscription` público, sem auth | **Confirmado** — rota ainda sem autenticação |
| C1b | **Crítico** | `PUT .../profiles/[supabaseId]/permanent-subscription` autoriza por `isMaster` de produto | **Confirmado** — `UpdatePermanentSubscriptionUseCase` ainda checa `requestingUser.isMaster` |
| C2 | **Crítico** | Cancelamento local não cancela no Asaas | **Confirmado** — `TODO` comentado em `SubscriptionManagementUseCase.cancelSubscription` |
| C2b | **Alto** | `updatePaymentMethod` / `retryPayment` retornam sucesso sem chamar Asaas | **Confirmado** — TODOs comentados no mesmo use case |
| C3 | **Crítico** | Confirmação/vínculo de assinatura grava `subscriptionPlan: 'manager_base'` fixo | **Confirmado** — `PaymentValidationService.ts` (~130, ~337) |
| C0 | **Crítico** | Webhook trata eventos/status que o Asaas não envia; fallback `?? 'active'` | **Confirmado** — ainda lista `SUBSCRIPTION_ACTIVATED/SUSPENDED/CANCELED`; `mapStatusFromPayload` não reconhece `INACTIVE`/`EXPIRED` |
| C-1 | **Crítico** | RLS ausente em `asaas_webhook_events`, `profile_user_types`, `profile_user_type_assignments` | **Confirmado no repo** — migrations criam tabelas sem `ENABLE ROW LEVEL SECURITY`; grants efetivos em produção ainda pendentes |
| — | **Alto** | `POST /api/v1/backoffice/payments` sem `requireManagerAccess` | **Confirmado** — só `getBackofficeAccess`; pricing usa `requireManagerAccess` |
| — | **Alto** | Refund/chargeback sem handler | **Confirmado** — sem cases de `PAYMENT_REFUNDED` / `PAYMENT_CHARGEBACK_*` |
| — | **Alto** | Preço hardcoded (~15 arquivos) + System A (59,90) vs System B (`BackofficeProduct`) | **Confirmado** — literais ainda em serviços/use cases/UI |
| — | **Alto** | Assinatura não expõe entitlements (`productSlugs`/`featureSlugs`/capacidades) de forma unificada | **Confirmado** — `SubscriptionCheckService` ainda binário (`status === 'active'`) |
| — | **Alto** | Duas definições de “assinatura ativa” (`FeatureAccessService` vs `SubscriptionCheckService`) | **Confirmado** — `active\|trial\|past_due` vs só `active` |
| **P-MS** | **Produto** | Precificação: 1 slug + parcelas só iguais; falta 1..N slugs e schedule custom | **Confirmado** — lacuna de produto (requisito owner 24/07) |
| **S-DUP** | **Alto** | Estado de assinatura **fragmentado** entre `Profile` e `ProfileSubscription` (dual-write / dual-read) | **Confirmado** — inventário §3A |

---

## 1. Segurança

### 1.1 C1 — Rota pública de vitalício

[`app/api/v1/profiles/permanent-subscription/route.ts`](app/api/v1/profiles/permanent-subscription/route.ts): `POST` sem sessão, sem `getBackofficeAccess`, sem checagem de papel. Aceita `{ profileId, enable }` e chama `togglePermanentSubscriptionUseCase`. Comentário no arquivo documenta uso via Postman em URL de produção.

**Impacto:** qualquer pessoa com um `profileId` válido pode tornar a conta vitalícia (bypass permanente de cobrança).

### 1.2 C1b — Master de produto auto-concede vitalício

[`UpdatePermanentSubscriptionUseCase.ts`](app/api/useCases/profiles/UpdatePermanentSubscriptionUseCase.ts): autorização ainda é `requestingUser.isMaster` (master **de produto**), não backoffice. Regra de negócio exigida: exclusivo `getBackofficeAccess()`.

### 1.3 C-1 — RLS nas tabelas de billing / tipo de usuário

No repositório:

- [`supabase/migrations/20260701134057_asaas-webhook-events.sql`](supabase/migrations/20260701134057_asaas-webhook-events.sql) — cria `asaas_webhook_events` **sem** RLS.
- [`supabase/migrations/20260607174554_add-profile-user-types.sql`](supabase/migrations/20260607174554_add-profile-user-types.sql) — cria `profile_user_types` / `profile_user_type_assignments` **sem** RLS.
- Nenhuma migration posterior habilita RLS nessas três tabelas (grep em `supabase/migrations`).

**Pendência:** calibrar se grants de `anon`/`authenticated` em produção permitem SELECT/INSERT/UPDATE (exposição confirmada vs. potencial). Remediação: migration com `ENABLE ROW LEVEL SECURITY` + policies; **não aplicar remoto sem autorização do owner**.

### 1.4 Backoffice — criação de cobrança sem papel de manager

[`app/api/v1/backoffice/payments/route.ts`](app/api/v1/backoffice/payments/route.ts) `POST`: só `getBackofficeAccess()`. Contraste: [`pricing/route.ts`](app/api/v1/backoffice/pricing/route.ts) chama `requireManagerAccess`. Qualquer operador autenticado no Backoffice pode criar cobrança Asaas via API direta; o frontend só esconde o botão.

---

## 2. Motor Asaas / webhook

### 2.1 C0 — Vocabulário inventado + fallback perigoso

[`PaymentValidationService.ts`](app/api/services/PaymentValidation/PaymentValidationService.ts) (~71–122):

- Lista de eventos inclui `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_SUSPENDED`, `SUBSCRIPTION_CANCELED` — **não emitidos** pela API real do Asaas (reais: `CREATED` / `UPDATED` / `INACTIVATED` / `DELETED`).
- `mapStatusFromPayload` reconhece `ACTIVE`, `SUSPENDED`, `INACTIVATED`, `CANCELLED`/`CANCELED` — **não** reconhece `INACTIVE` nem `EXPIRED` (valores reais do enum de assinatura Asaas).
- `mappedStatus = mappedFromEvent ?? mappedFromPayload ?? 'active'` — status desconhecido **reativa** conta.

Mesmos eventos fantasmas ainda aparecem em [`processAsaasWebhookEvent.ts`](app/api/webhooks/asaas/processAsaasWebhookEvent.ts) (~330–333).

**Consequência:** `SUBSCRIPTION_UPDATED` com `status: "INACTIVE"` ou `"EXPIRED"` pode gravar `subscriptionStatus: 'active'`. Estado local `suspended` via webhook permanece praticamente inalcançável pelos eventos inventados.

### 2.2 C3 — Plano forçado para `manager_base`

No vínculo de assinatura e em `updateProfileStatus`, `subscriptionPlan: 'manager_base'` é hardcoded. Contas `with_operators` regridem a cada confirmação/vínculo.

### 2.3 C2 — Cancelamento / cartão / retry mentem sucesso

[`SubscriptionManagementUseCase.ts`](app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase.ts):

- `cancelSubscription` (~661): `// TODO: Chamar API Asaas para cancelar` — só marca `canceled` local; Asaas continua cobrando.
- `updatePaymentMethod` / `retryPayment`: mesma padrão (chamada comentada + `Output` de sucesso). Frontend de retry aponta para rota `invoices/retry` que **não existe** no tree de subscription-management (achado 20/07, revalidar path na SPEC).

### 2.4 Refund / chargeback

Tipos podem existir em `AsaasWebhookTypes`, mas **não há handlers** para `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_CHARGEBACK_*`. Conta pode permanecer `active` após estorno/contestação.

### 2.5 Inadimplência no Asaas

Asaas **não** inativa sozinho por atraso (doc oficial). App marca `past_due` em `PAYMENT_OVERDUE`, mas **não** chama `PUT /v3/subscriptions/{id}` com `status: INACTIVE` — assinatura Asaas pode continuar `ACTIVE` gerando cobranças.

### 2.6 Idempotência do webhook

Tabela `asaas_webhook_events` + `claimForProcessing` existem (bom). Gaps legados ainda válidos: claim não atômico (`findUnique` + `create`); fallback de `eventId` com `Date.now()` não é idempotente; handlers internos sem testes.

---

## 3A. Tabelas de assinatura — inventário (reauditoria 24/07)

**Achado S-DUP:** a assinatura **não** vive em uma única fonte de verdade. Há espelhamento intencional “for legacy compatibility” e leitores que escolhem Profile **ou** ProfileSubscription (às vezes com fallback OR).

### 3A.1 Mapa de entidades

| Entidade | Tabela | Papel | Cardinalidade |
|---|---|---|---|
| `Profile` (campos billing) | `profiles` | Status/plano/Asaas/cycle/datas/`hasPermanentSubscription` **ainda no perfil** | 1 row / user |
| `ProfileSubscription` | `corretor_studio_profile_subscriptions` | Assinatura 1:1 do master (+ `productId`, `adhesionId`) | 1 / master |
| `BackofficeUserSubscription` | `backoffice_user_subscriptions` | Produtos contratados | N / profile |
| `ProfileSubscriptionCapacity` | `corretor_studio_profile_subscription_capacities` | Extra teams/users | 0..1 / ProfileSubscription |
| `ProfileUserType` + `Assignment` | `profile_user_types` / `profile_user_type_assignments` | Nível (`common`, `member_pro`, `associate`, …) | 1 assignment / profile |
| `BackofficeAdhesion` | adesões | Checkout comercial; seed de capacity/subscription | N |

Campos **duplicados** Profile ↔ ProfileSubscription: `subscriptionStatus`, `subscriptionPlan`, `asaasSubscriptionId` (Profile também tem `subscriptionId` legado), datas, `subscriptionCycle`, `hasPermanentSubscription`. `asaasCustomerId` fica só no Profile (identidade de cliente — ok).

### 3A.2 Writers (quem grava)

| Writer | Destino | Evidência |
|---|---|---|
| `PaymentRepository.updateSubscriptionStatus/Data` | **Dual-write** ProfileSubscription + Profile (“legacy compatibility”) | [`PaymentRepository.ts`](app/api/infra/data/repositories/payment/PaymentRepository.ts) ~45–99 |
| `AsaasSubscriptionSyncRepository.saveSyncData` | **Dual-write** ProfileSubscription + Profile | [`AsaasSubscriptionSyncRepository.ts`](app/api/infra/data/repositories/billing/AsaasSubscriptionSyncRepository.ts) ~46–66 |
| `BillingRepository` update subscription | Profile + ProfileSubscription | [`BillingRepository.ts`](app/api/infra/data/repositories/billing/BillingRepository.ts) |
| `BackofficeAdhesionRepository` | upsert ProfileSubscription + Capacity | adesão paga |
| `SubscriptionCreditRepository` | ProfileSubscription + Capacity | créditos/extras |
| `CheckoutAsaasUseCase` / `SubscriptionUpgradeUseCase` / `CreateManagerOnboarding` / `processAsaasWebhookEvent` / `SubscriptionManagementUseCase.cancel` | frequentemente **só Profile** (ou Profile primeiro) | vários paths System A |
| `TogglePermanentSubscriptionUseCase` | Profile (`hasPermanentSubscription`) | rota pública C1 |
| `BackofficeUserSubscriptionRepository` | BackofficeUserSubscription | create/update por produto |
| `BackofficeAllUsersRepository.upsertUserTypeAssignment` | ProfileUserTypeAssignment | Member PRO / tipos; também via adesão |

### 3A.3 Readers (quem lê)

| Reader | Fonte preferida | Nota |
|---|---|---|
| `FeatureAccessRepository` / `FeatureAccessService` | ProfileSubscription + BackofficeUserSubscription + Assignment | Gate de slugs |
| `SubscriptionCheckService` | Profile (`subscriptionStatus === 'active'`) | **Não** usa ProfileSubscription — divergência com FeatureAccess |
| `PaymentRepository.findBySubscriptionId` | ProfileSubscription **primeiro**, fallback Profile.`subscriptionId` | Comentário “Legacy fallback” |
| `AsaasSubscriptionSyncRepository.getSyncSnapshot` | OR entre ProfileSubscription e Profile | `??` / `\|\|` |
| `BillingRepository.getBillingSnapshot` | Profile flags + Capacity **ou** quota de adesão legada | Dual path de capacidade |
| `SubscriptionManagementUseCase` | ProfileSubscription + updates em Profile | Misto |
| Backoffice platform/users | Profile + relation `subscription` | Lista/detalhe |

### 3A.4 Inconsistências concretas

1. **Dual-write sem garantia transacional única** em vários fluxos — risco de Profile e ProfileSubscription divergirem se um update falhar.
2. **Dual-read com OR** mascara divergência (sync snapshot / findBySubscriptionId).
3. **SubscriptionCheck** ignora ProfileSubscription → bug trial/past_due (sidebar vs página).
4. **`hasPermanentSubscription` em duas colunas** — sync OR trata qualquer `true` como vitalício; writers nem sempre atualizam os dois.
5. **Capacity vs adesão:** `BillingRepository` ainda tem `getLegacyAdhesionQuota` se capacity ausente.
6. **System A** grava preço/plano em Profile sem necessariamente criar `BackofficeUserSubscription` / `productId` em ProfileSubscription.

### 3A.5 Alvo recomendado para a SPEC (D14)

- **Canônico:** `ProfileSubscription` (status, plano, Asaas subscription id, cycle, datas) + `BackofficeUserSubscription` (produtos) + `ProfileSubscriptionCapacity` (extras) + `ProfileUserTypeAssignment` (nível).
- **Profile:** manter `asaasCustomerId` e identidade; **descontinuar** campos de assinatura espelhados após cutover (ou sync unidirecional só durante migração).
- **Migrar todos** os dados System A → modelo novo; **sem** `crm-legacy` permanente.
- **Mudança de nível** entre quaisquer níveis suportados (user type + produtos); Member PRO = exemplo, não caminho único.

---

## 3. Precificação

### 3.1 Dois sistemas coexistindo (estado atual; cutover obrigatório)

| Sistema | Origem do preço | Valor típico CRM |
|---|---|---|
| **A (legado)** | Literais em código + `billingConfig.ts` | R$ 59,90 / op R$ 19,90 / time R$ 29,90 |
| **B (catálogo)** | `BackofficeProduct` + `BackofficeProductPaymentRule` | R$ 89,90/mês PIX (seed) + variantes |

**Decisão owner (24/07):** **não haverá modelo legado permanente.** Migrar **todos** os dados para o modelo novo (catálogo + ProfileSubscription canônico). Pós-cutover: só banco; zero literais / zero `crm-legacy`.

Literais **ainda presentes** (amostra 24/07): `AsaasSubscriptionService`, `AsaasOperatorService`, `CheckoutAsaasUseCase`, `SubscriptionUpgradeUseCase`, `ManagerUserUseCase`, `CreateManagerOnboarding`, `create-card/route.ts`, `SubscriptionManagementUseCase`, `BackofficeAllUsersUseCase`, `BackofficePlatformUsersUseCase`, `billingConfig.ts`, UI `SubscriptionCard` / `SubscriptionBillingBreakdownCard` / `ReactivateSubscriptionDialog` / `SubscriptionCreditsDialog`.

### 3.2 Modelo atual do catálogo (System B)

[`BackofficeProduct`](prisma/schema.prisma): **um** campo `featureSlug String` (não unique — variantes com `isDefault`).  
[`BackofficeProductPaymentRule`](prisma/schema.prisma): `price`, `canInstallment`, `maxInstallments` por `(productId, paymentMethod, billingCycle)`.

UI: [`BackofficeProductDialog.tsx`](app/backoffice/(app)/pricing/features/components/BackofficeProductDialog.tsx) — Select **único** de slug; helper: *“Múltiplas precificações podem usar o mesmo slug”* (várias variantes → um slug), **não** vários slugs → uma precificação.

Cobrança adesão: [`BackofficeAdhesionService.ts`](app/api/services/backofficeAdhesion/BackofficeAdhesionService.ts) (~1204–1206) — `installmentValue = chargeAmount / installments` (sempre iguais).

`subscriptionCycle` / alguns status de pagamento ainda são `String` livres (risco de case: `"quarterly"` vs `"MONTHLY"` — achado de produção 20/07).

### 3.3 Lacuna de produto P-MS (requisito owner 24/07) — **novo foco para SPEC**

Decisões do owner (capturadas aqui; **não implementadas**):

1. **Uma precificação engloba 1..N feature slugs** (toda funcionalidade tem slug; o produto vende o pacote).
2. **Parcelas só no cadastro** de precificação (`/backoffice/pricing`); checkout/adesão **consome** a regra.
3. Modo **iguais:** respeitar `maxInstallments` (cliente escolhe `1..N`).
4. Modo **custom:** só à vista **ou** exatamente o schedule definido (ex. `[1200, 990, 990]` — sem outras opções de N).

**Restrição Asaas (fato técnico para a SPEC):** a API nativa de parcelamento (`installmentCount` + `installmentValue`/`totalValue`) gera **apenas parcelas iguais**. Schedule desigual não cabe em um único parcelamento Asaas — implica N cobranças avulsas (ou desenho equivalente na SPEC).

### 3.4 Demais inconsistências de catálogo

Detalhadas em `PRICING_MODEL.md` / `PRICING_TABLE.md` (não duplicadas): variantes só em produção fora do seed/migration; `crm-lifetime` com preços null; acréscimo de cartão inconsistente entre produtos; etc.

### 3.5 Preço negociado por adesão

Requisito 20/07: desconto % por adesão com teto + aprovação — **ainda sem campos** em `BackofficeAdhesion` / `adhesion-pricing.ts`. Contratos PDF (`BackofficeContract*`) não carregam valor monetário.

---

## 4. Feature gating e entitlements

- [`FeatureAccessService`](app/api/services/featureAccess/FeatureAccessService.ts): `ACTIVE_SUBSCRIPTION_STATUSES = { active, trial, past_due }` + permanente + Member PRO.
- [`SubscriptionCheckService`](app/api/services/SubscriptionCheck/SubscriptionCheckService.ts): `isActive = subscriptionStatus === 'active'` — binário; sem `productSlugs` / `featureSlugs` / capacidades.

**Bug de UX reproduzível:** conta `trial`/`past_due` pode ter sidebar liberada e página bloqueada pelo `SubscriptionGuard`.

Add-ons multiplicáveis (`extra-team` / `extra-user`): capacidade em `ProfileSubscriptionCapacity` / adesão; gate de slug **não** exige capacidade positiva de forma unificada.

---

## 5. Backoffice UI (billing)

Revalidado 24/07 onde indicado:

| Achado | Status |
|---|---|
| Controles noop em detalhe de fatura (`handleNoopAction` — “Compartilhar fatura” etc.) | **Confirmado** em `BackofficeClientInvoiceDetailsContainer.tsx` |
| Toggle vitalício sem `AlertDialog` | Achado 20/07 — manter na SPEC de UI |
| Dialogs de “Nova Cobrança” / PIX sem wrapper de scroll governança | Achado 20/07 — manter na SPEC de UI |

---

## 6. E-mails, alertas e Member PRO

Resumo do audit 20/07, ainda aplicável salvo prova contrária:

- Confirmação de pagamento automática (fire-and-forget); atraso/vencimento **manual** no Backoffice; sem dunning automático.
- E-mails de billing via `sendEmailUntracked` — sem `EmailLog` / analytics.
- Webhooks Asaas falhos sem tela de reprocesso no Backoffice (diferente do padrão WhatsApp).
- Cron `member-pro-expiration`: janela até ~24h entre fim do benefício e sync da assinatura; falha cadastral só em log; sem checkout explícito na transição.

---

## 7. Performance e débito técnico (resumo)

- Índices ausentes em lookups Asaas no `Profile` (`asaasCustomerId`, `subscriptionId`, `asaasSubscriptionId`) — achado 20/07.
- `asaasFetch` sem timeout explícito.
- Sem cache em feature access / subscription check.
- `SubscriptionUpgradeUseCase` monolítico; fluxos de operador triplicados; dois clientes HTTP Asaas em `lib/asaas.ts`.

---

## 8. Testes

Cobertura de webhook / `PaymentValidationService` / checkout / cancelamento / IncrementalBilling **insuficiente** para o risco financeiro (zero ou quase zero testes dedicados — status do audit ENGINE, sem evidência de mudança nesta rodada).

---

## 9. Perguntas bloqueantes / decisões

| # | Tema | Status |
|---|---|---|
| 1 | Grants `anon`/`authenticated` nas tabelas C-1 em produção | **Aberto** — investigar no Estágio -1 |
| 2 | Migração System A → modelo único | **Resolvido (owner):** migrar **todos**; sem legado permanente |
| 2b | Mudança de nível de assinatura | **Resolvido (owner):** entre **quaisquer** níveis suportados; Member PRO é exemplo |
| 3 | `crm-lifetime` → `hasPermanentSubscription` | **Aberto** — SPEC exige fechar o elo |
| 4 | Overage e-mail sem auto-charge | **Default SPEC:** bloquear novos disparos |
| 5 | Onde expor entitlements | **Default SPEC:** check + bootstrap (não endpoint novo) |
| 6 | Asaas produção (valores anômalos / ciclos) | **Aberto** — checklist no cutover |
| 7 | P-MS parcelas custom no Asaas | **Default SPEC:** N cobranças avulsas |

---

## 10. Próximo passo

1. Implementar por estágios o [`BILLING_SPEC.md`](BILLING_SPEC.md) **v2.0** (baseado neste audit, incl. §3A S-DUP).
2. `BILLING_ENGINE_SPEC.md` **removido** (24/07).
3. Código só após autorização por estágio; migrations remotas só com auth do owner.
