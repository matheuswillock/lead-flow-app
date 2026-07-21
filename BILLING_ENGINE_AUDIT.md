# BILLING_ENGINE_AUDIT.md — Auditoria do Motor de Cobrança/Assinaturas (Asaas)

**Data:** 2026-07-09
**Escopo:** ativação de recorrência, add-ons, feature gating, precificação, integração Asaas
**Método:** leitura de código + schema + docs do repositório, e consulta direta à API do Asaas (ambiente **sandbox**, único acessível desta máquina) e à especificação OpenAPI oficial do Asaas.
**Nenhum código foi alterado nesta rodada.**

---

## 🔴 ACHADOS CRÍTICOS (ler primeiro)

### C1. `POST /api/v1/profiles/permanent-subscription` é PÚBLICO — bypass total de cobrança sem autenticação

[app/api/v1/profiles/permanent-subscription/route.ts](app/api/v1/profiles/permanent-subscription/route.ts) não tem **nenhuma** verificação de autenticação ou autorização. O proxy ([proxy.ts:106](proxy.ts:106)) apenas injeta `x-supabase-user-id` quando há sessão, mas **não bloqueia** requisições `/api` sem sessão — a autorização é responsabilidade de cada rota, e esta rota não faz nenhuma. O `TogglePermanentSubscriptionUseCase` também não valida quem chama (zero referências a `isMaster`, `backoffice` ou auth no arquivo).

**Cenário de exploração:** qualquer pessoa na internet com um `profileId` válido pode fazer `POST { "profileId": "...", "enable": true }` e tornar a conta vitalícia (bypass permanente de toda a cobrança). O comentário no próprio arquivo documenta o uso via Postman contra a URL de produção.

A rota irmã `PUT /api/v1/profiles/[supabaseId]/permanent-subscription` autentica, mas autoriza por `requestingUser.isMaster` ([UpdatePermanentSubscriptionUseCase.ts:56](app/api/useCases/profiles/UpdatePermanentSubscriptionUseCase.ts:56)) — ou seja, **qualquer master pagante pode tornar a si mesmo vitalício**. A regra de negócio exigida é: restrito ao Backoffice (`getBackofficeAccess()`), nunca exposto a rota de produto. Ambas as rotas violam.

### C2. Cancelamento local NÃO cancela no Asaas — cliente cancelado continua sendo cobrado

[SubscriptionManagementUseCase.ts:660](app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase.ts:660):

```typescript
// TODO: Chamar API Asaas para cancelar assinatura
// await asaasService.cancelSubscription(profile.subscriptionId);
```

`cancelSubscription` marca `subscriptionStatus: 'canceled'` só no banco local. A assinatura no Asaas permanece `ACTIVE` e **continua gerando cobranças mensais reais** contra o cliente. Este é o risco financeiro/jurídico mais direto encontrado.

### C3. Toda confirmação de pagamento força `subscriptionPlan: 'manager_base'`

[PaymentValidationService.ts:334-340](app/api/services/PaymentValidation/PaymentValidationService.ts:334) (`updateProfileStatus`) grava `subscriptionPlan: 'manager_base'` **hardcoded** em toda confirmação de pagamento — inclusive em renovações de contas `with_operators`. A cada ciclo pago, o plano da conta regride no banco. O mesmo hardcode aparece no handler de `SUBSCRIPTION_CREATED` (linha 130).

### C4. Divergência de precificação — o que foi de fato encontrado

A hipótese do briefing (R$ 59,90 vs R$ 89,90) **não se reproduz no repositório**: não existe nenhuma ocorrência de `89,90` em código ou docs (verificado com grep no repo inteiro). As divergências reais são:

| Fonte | Base | Operador | Time adicional | Ciclos |
|---|---|---|---|---|
| **Asaas sandbox (API, fonte mais confiável acessível)** | R$ 59,90 | +R$ 19,90 (valor somado na assinatura única) | +R$ 29,90 (idem) | **100% MONTHLY** (35/35 assinaturas) |
| Código (`billingConfig.ts` + 14 arquivos com literais) | 59.90 | 19.90 | 29.90 | `MONTHLY` hardcoded |
| `docs/ADD_OPERATOR_PAYMENT_FLOW.md` e `docs/OPERATOR_PAYMENT_FLOW_COMPLETE.md` | — | **R$ 20,00/mês** (desatualizado) | — | — |
| `docs/AI_PROJECT_CONTEXT.md`, `project-context.instructions.md` | R$ 59,90 | R$ 19,90 | **ausente** | — |
| Enum `SubscriptionPlan` (schema) | `manager_base` | `with_operators` | **ausente** | — |

Achados adicionais da consulta à API sandbox:

- **3 assinaturas com `value: 5990`** (cinco mil, novecentos e noventa reais) — forte indício de bug de conversão centavos↔reais em algum fluxo de criação/atualização. Investigar origem antes de qualquer refactor.
- Ciclos trimestral/semestral/vitalício **não existem** nem no Asaas sandbox nem no código (tudo `MONTHLY`). "Vitalício" existe apenas como a flag manual `hasPermanentSubscription`, não como plano comercial cobrado.
- **Asaas não tem catálogo de planos/produtos**: assinaturas são value-based (`value` + `cycle` livres por assinatura). Não existe `productId`/`planId` a validar — a definição de preço vive **exclusivamente no código**, o que torna a ausência de fonte única (item 1 abaixo) ainda mais grave.

⚠️ **Pendência de verificação:** a chave `ASAAS_API_KEY` local é **sandbox** (`ASAAS_ENV=sandbox`). A configuração de **produção** não pôde ser confirmada desta máquina — ver "Perguntas bloqueantes" ao final.

---

## Auditoria item a item (AUDIT — factual)

### 1. Fonte única de verdade para precificação — ❌ NÃO EXISTE

`BILLING_PRICES` existe em [billingConfig.ts](app/api/shared/billing/billingConfig.ts) (`base: 59.9, extraTeam: 29.9, extraUser: 19.9`), mas é usado apenas pelo fluxo incremental. Os mesmos valores estão **hardcoded em pelo menos 15 outros pontos**:

**Backend:**
- [AsaasSubscriptionService.ts:79,104](app/api/services/AsaasSubscription/AsaasSubscriptionService.ts:79) — `59.90` / `19.90`
- [AsaasOperatorService.ts:83,122,233,234](app/api/services/AsaasOperator/AsaasOperatorService.ts:83) — `19.90` / `59.90`
- [CheckoutAsaasUseCase.ts:207,455,596,600](app/api/useCases/subscriptions/CheckoutAsaasUseCase.ts:207) — `59.90` / `19.90`
- [SubscriptionUpgradeUseCase.ts:169,461,973,974](app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts:973) — `BASE_VALUE = 59.90`, `OPERATOR_VALUE = 19.90`
- [ManagerUserUseCase.ts:527](app/api/useCases/managerUser/ManagerUserUseCase.ts:527) — `Math.max(59.90, value - 19.90)`
- [CreateManagerOnboarding.ts:89](app/api/useCases/CreateManagerOnboarding.ts:89) — `59.90`
- [create-card/route.ts:8](app/api/v1/payments/create-card/route.ts:8) — `PLAN_PRICE = 59.9`
- [SubscriptionManagementUseCase.ts:385-387](app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase.ts:385) — `59.9` / `29.9` / `19.9`
- [BackofficeAllUsersUseCase.ts:32-33](app/api/useCases/backoffice/BackofficeAllUsersUseCase.ts:32) e [BackofficePlatformUsersUseCase.ts:238-239](app/api/useCases/backoffice/BackofficePlatformUsersUseCase.ts:238) — fórmula de preço duplicada
- [EmailCreditUseCase.ts:182](app/api/useCases/email/EmailCreditUseCase.ts:182) — duplica `overageRatePer100` que já existe em [EmailCreditService.ts:16](app/api/services/EmailCredit/EmailCreditService.ts:16)

**Frontend (fallbacks hardcoded que mascaram dessincronia):**
- [SubscriptionCard.tsx:68,74,76,77](app/[supabaseId]/subscription/features/container/SubscriptionCard.tsx:68)
- [SubscriptionBillingBreakdownCard.tsx:15,16,31](app/[supabaseId]/subscription/features/container/SubscriptionBillingBreakdownCard.tsx:15)
- [ReactivateSubscriptionDialog.tsx:53-54](app/[supabaseId]/subscription/features/container/ReactivateSubscriptionDialog.tsx:53)
- [SubscriptionCreditsDialog.tsx:36](app/[supabaseId]/subscription/features/container/SubscriptionCreditsDialog.tsx:36)

Uma mudança de preço hoje exige editar ~15 arquivos; esquecer um deles significa cobrar um valor e exibir outro.

**`subscriptionCycle` é `String` livre** ([schema.prisma:658](prisma/schema.prisma:658), comentário "MONTHLY, QUARTERLY, etc"). Escritas encontradas: `'MONTHLY'` hardcoded em ≥6 pontos do `SubscriptionUpgradeUseCase`/`CheckoutAsaasUseCase`; `subscription.cycle || "MONTHLY"` no webhook ([processAsaasWebhookEvent.ts:303](app/api/webhooks/asaas/processAsaasWebhookEvent.ts:303)); valor cru do Asaas no sync ([AsaasSubscriptionSyncService.ts:55](app/api/services/billing/AsaasSubscriptionSyncService.ts:55)). Não há enum nem validação — qualquer typo persiste silenciosamente.

### 2. Ativação de recorrência — ⚠️ PARCIAL

**O que funciona bem:**
- **Idempotência estrutural do webhook existe e é boa**: [route.ts:61-73](app/api/webhooks/asaas/route.ts:61) usa `claimForProcessing` sobre a tabela `asaas_webhook_events` (migration `20260701134057`) com estados `processing/processed/failed` — reentrega do mesmo `eventId` é rejeitada com 200.
- Token do webhook validado contra `ASAAS_WEBHOOK_TOKEN` (401 se inválido).
- `PAYMENT_OVERDUE` → `past_due` implementado ([PaymentValidationService.ts:152-184](app/api/services/PaymentValidation/PaymentValidationService.ts:152)).
- `SUBSCRIPTION_SUSPENDED/INACTIVATED` → `suspended`; `CANCELED/DELETED` → `canceled`.

**Gaps:**
- **Idempotência semântica incompleta**: o processamento interno não é transacional. Se `processAsaasWebhookEvent` falha no meio, o evento vira `failed` e a reentrega do Asaas reprocessa do zero — os handlers individuais (criação de operador, ativação) precisam ser individualmente idempotentes, e isso não é testado (zero testes no módulo de webhook).
- **Regressão de status por default**: no handler `SUBSCRIPTION_*`, `mappedStatus = mappedFromEvent ?? mappedFromPayload ?? 'active'` ([PaymentValidationService.ts:122](app/api/services/PaymentValidation/PaymentValidationService.ts:122)) — um `SUBSCRIPTION_UPDATED` com status não reconhecido **reativa** uma conta suspensa.
- **`subscriptionNextDueDate`** só é atualizado em `SUBSCRIPTION_CREATED/UPDATED` (com `parseBrazilianDate` DD/MM/YYYY) e no sync on-demand (`AsaasSubscriptionSyncService`, formato ISO). Confirmação de pagamento (`PAYMENT_CONFIRMED`) **não** avança o `nextDueDate` — o dado local depende de o Asaas emitir `SUBSCRIPTION_UPDATED` a cada ciclo.
- **Não há transição automática `past_due → suspended`**: nenhum cron de billing além de `member-pro-expiration` ([vercel.json](vercel.json)). A suspensão depende exclusivamente de o Asaas emitir o evento.
- `regressão de plano`: ver C3.

### 3. Validação de add-ons — ⚠️ PARCIAL

**Operador (existe):** `PendingOperator` ([schema.prisma:1656](prisma/schema.prisma:1656)) → checkout/cobrança Asaas → webhook confirma (`processOperatorCheckoutPaid` / `confirmPaymentAndCreateOperator` via `externalReference: pending-operator-*`) → operador criado. Remoção: `removeOperatorAndUpdateSubscription` e [ManagerUserUseCase.ts:527](app/api/useCases/managerUser/ManagerUserUseCase.ts:527) decrementam R$ 19,90 com floor em 59,90. `paymentStatus`/`paymentMethod` do `PendingOperator` são `String` livres (mesmo problema do cycle).

**Time Adicional (existe — hipótese do briefing refutada):** o add-on é real e **está gated por cobrança**: [teams/payments/create/route.ts](app/api/v1/teams/payments/create/route.ts) + `IncrementalBillingService` (R$ 29,90 de `BILLING_PRICES.extraTeam`) + `PendingAction` (`pending_action_type: create_team`) confirmado via webhook (`pending-action-*`). Bypasses legítimos: `hasPermanentSubscription` e Member PRO (`memberProBillingUseCase.shouldBypassIncrementalCharge`). O gap real é outro: **`SubscriptionPlan` enum não representa o add-on**, e a doc de contexto não o menciona.

**Email Campaigns:** `EmailCreditSubscription` é por Team, **sem nenhuma integração com Asaas** — não há cobrança real dos planos de crédito de e-mail hoje. Overage: ver 3.1.

**Dialer:** nenhum módulo de billing de Dialer encontrado em `app/api` (nenhuma referência a licença/proração de Dialer no código de cobrança). Se a spec do Dialer existe, a implementação de billing dela ainda não aterrissou neste repo.

**Decisão arquitetural pendente:** hoje coexistem **3 modelos de billing** sem decisão documentada — (a) assinatura única mutável no Asaas (base+operadores+times, valor somado), (b) `EmailCreditSubscription` local sem cobrança, (c) `BackofficePayment`/adesões. A spec formaliza isso.

### 3.1 Overage de e-mail — ❌ NÃO EXISTE cobrança (confirmado)

A dúvida da auditoria de e-mail está fechada: `overageCharged` é **apenas registrado**, nunca cobrado. O cron de reset admite explicitamente ([reset-credits/route.ts:70-72](app/api/v1/email/cron/reset-credits/route.ts:70)):

```typescript
if (usage && Number(usage.overageCharged) > 0) {
  console.info(`... teve excedente de R$${usage.overageCharged} — cobrança avulsa pendente de implementação`)
```

Não existe `autoChargeOverage`, não existe validação de cartão, não existe registro tipo `PendingOverageCharge`. O comportamento quando o Time estoura o crédito (bloquear vs. permitir com aviso) precisa ser confirmado na spec — ver pergunta bloqueante (d).

### 4. Feature gating central — ✅ EXISTE (com vazamentos)

[FeatureAccessService](app/api/services/featureAccess/FeatureAccessService.ts) + tabelas `backoffice_features`/`backoffice_feature_access_rules` + `accessMode PUBLIC/PAID/ADDON` + `FEATURE_PRODUCT_SLUG_MAP` respondem "este usuário tem acesso à feature X?" de forma central, considerando assinatura ativa (`ACTIVE_SUBSCRIPTION_STATUSES = active|trial|past_due`), `hasPermanentSubscription`, Member PRO, beta e banimento. É consultável no backend e alimenta a sidebar no frontend.

**Vazamentos:** módulos de billing ainda checam `subscriptionStatus` diretamente (ex.: [teams/payments/create/route.ts:162](app/api/v1/teams/payments/create/route.ts:162), rotas de teams, `SubscriptionCheckService`), cada um com sua própria noção de "ativo". O conjunto `active|trial|past_due` do gate central não está compartilhado como constante única.

### 5. Gerenciamento de precificação (operação) — ❌ NÃO EXISTE / decisão em aberto

Preço é 100% código versionado (e nem isso de forma centralizada — item 1). Não há UI de precificação no Backoffice nem tabela de preços em banco. **Não assumido**: se preço editável em runtime é requisito real, é decisão de negócio a confirmar — a spec propõe o caminho mínimo (fonte única em código) com evolução opcional para tabela.

### 6. Integração Asaas — ⚠️ PARCIAL

- **Eventos tratados:** `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_APPROVED` (cartão), `PAYMENT_OVERDUE`, `SUBSCRIPTION_CREATED/UPDATED/ACTIVATED/INACTIVATED/SUSPENDED/CANCELED/DELETED`.
- **Eventos NÃO tratados:** `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_*`, `PAYMENT_DELETED`, `PAYMENT_UPDATED`, mudança de forma de pagamento. Os tipos existem em `AsaasWebhookTypes.ts` mas não há handler — um estorno não regride status nem notifica ninguém.
- **`productId`/`planId`:** não aplicável — confirmado na spec OpenAPI oficial que o Asaas **não tem catálogo de planos**; assinaturas carregam `value`+`cycle` próprios.
- **Mudança de ciclo (pergunta (e) do briefing) — RESPONDIDA:** `PUT /v3/subscriptions/{id}` aceita `cycle` (`WEEKLY|BIWEEKLY|MONTHLY|BIMONTHLY|QUARTERLY|SEMIANNUALLY|YEARLY`) + `updatePendingPayments` — mudança de ciclo é **atualização in-place da assinatura existente**, não cancelar+recriar.
- Sandbox vs produção: `lib/asaas.ts` resolve por `ASAAS_ENV`; ambiente local é sandbox; produção não verificada (pendência).

### 7. Ciclo de vida da assinatura — ⚠️ PARCIAL

- **Nova adesão:** ✅ existe — `CreateManagerOnboarding` (customer + assinatura 59,90) e `CheckoutAsaasUseCase` (checkout Asaas + `processCheckoutPaid` ativa via webhook), trial via `SubscriptionStatus.trial`/`trialEndDate`.
- **Upgrade:** existe apenas como "adicionar operador/time" (incremento de `value` na assinatura única, sem proração — o incremento vale a partir da próxima fatura; a primeira cobrança do add-on é feita à parte como cobrança avulsa no `IncrementalBillingService`).
- **Downgrade de plano:** ❌ não existe fluxo formal. Remover operador decrementa o valor; não há tratamento para "downgrade deixa o Time com mais operadores ativos que o novo limite" porque não há conceito de limite por plano — o modelo é aditivo por unidade.
- **Mudança de período/ciclo:** ❌ não existe (tudo MONTHLY hardcoded). Viável via `PUT` conforme item 6.
- **Permissão:** rotas de add-on exigem master/manager delegado via `getTeamAccess`; `SubscriptionManagementUseCase` opera por `supabaseId` do dono. Não há verificação explícita "somente master" em todos os fluxos de assinatura (`cancelSubscription` não checa papel — qualquer sessão com o supabaseId do perfil, o que na prática é o próprio dono).
- **Auditoria de mudanças:** ❌ não existe registro de quem mudou plano/valor/ciclo, de-para, quando. `PendingAction`/`PendingOperator` cobrem apenas os add-ons.

### 8. Testes — ❌ INSUFICIENTE para o risco

Existem: `memberProBillingRules.test.ts` (em expansão no branch atual), `EmailCreditService.test.ts`, `route-access.test.ts`, `HealthPlanUseCase.test.ts`. **Zero testes** para: webhook Asaas (idempotência, claim/retry), `PaymentValidationService` (transições de estado), `CheckoutAsaasUseCase`, `SubscriptionUpgradeUseCase`, `IncrementalBillingService`, `SubscriptionManagementUseCase`. O módulo de maior risco financeiro é o menos testado do produto.

---

## CRITIQUE — riscos priorizados

| # | Sev | Risco | Evidência |
|---|-----|-------|-----------|
| 1 | **P0** | Rota pública torna qualquer conta vitalícia sem auth | C1 |
| 2 | **P0** | Cancelamento não cancela no Asaas — cobrança contínua indevida | C2 |
| 3 | **P0** | Master de produto pode se auto-conceder `hasPermanentSubscription` | C1 (rota PUT) |
| 4 | **P1** | Confirmação de pagamento regride `subscriptionPlan` para `manager_base` | C3 |
| 5 | **P1** | Assinaturas com `value: 5990` no sandbox — possível bug centavos/reais em produção | consulta API sandbox |
| 6 | **P1** | `SUBSCRIPTION_UPDATED` com status desconhecido default-ativa conta suspensa | PaymentValidationService.ts:122 |
| 7 | **P1** | Estorno/chargeback não tratado — conta permanece ativa após refund | item 6 |
| 8 | **P1** | Preço hardcoded em ~15 arquivos — dessincronia cobrado × exibido | item 1 |
| 9 | **P1** | Overage de e-mail registrado mas nunca cobrado (receita perdida silenciosa) | item 3.1 |
| 10 | **P2** | `subscriptionCycle`/`paymentStatus`/`paymentMethod` como String livre | item 1 |
| 11 | **P2** | Sem cron de reconciliação Asaas↔banco (`AsaasSubscriptionSyncService` é só on-demand) | item 2 |
| 12 | **P2** | `nextDueDate` local pode ficar obsoleto (não atualiza em PAYMENT_CONFIRMED) | item 2 |
| 13 | **P2** | Checks de `subscriptionStatus` duplicados fora do FeatureAccessService | item 4 |
| 14 | **P2** | Docs de billing desatualizados (R$ 20,00; fluxos antigos) | C4 |
| 15 | **P3** | `notify-payment` via `fetch` para si mesmo (frágil, sem retry) | processAsaasWebhookEvent.ts:368 |

## Débito técnico estrutural

- `SubscriptionUpgradeUseCase` com 1.527 linhas, payloads `any`, logs de debug verbosos em produção.
- Fluxos de operador triplicados: `AsaasOperatorService`, `CheckoutAsaasUseCase`, `SubscriptionUpgradeUseCase` implementam variações do mesmo "adicionar operador +19,90".
- Dois clientes HTTP Asaas em `lib/asaas.ts` (`asaasFetch` + `asaas` legado).
- `PaymentValidationService.processWebhook` mistura ativação, e-mail transacional e mapeamento de status num único método.

---

## Perguntas bloqueantes (respostas necessárias antes de fechar decisões da spec)

**(a) Produção Asaas — NÃO VERIFICÁVEL desta máquina.** A chave local é sandbox. Necessário: rodar a mesma consulta (`GET /v3/subscriptions?limit=100`, agregando `cycle`/`value`/`status`) com a chave de produção, ou conferir no painel. Em especial: confirmar se existem assinaturas com valores anômalos (como os `5990` do sandbox) em produção.

**(b) R$ 89,90 — valor não encontrado em nenhuma fonte do repositório.** Se esse valor foi visto em algum lugar (Notion, landing externa, material comercial), indicar a fonte. As divergências reais documentais são R$ 20,00 vs R$ 19,90 (docs antigos de operador).

**(c) Time Adicional — RESPONDIDA pelo código:** é add-on comercial real (R$ 29,90, gated por cobrança via `PendingAction`). Confirmar apenas se o preço 29,90 está correto comercialmente.

**(d) Comportamento ao estourar crédito de e-mail com `autoChargeOverage` desligado — SEM DEFINIÇÃO em nenhum doc.** Opções: (i) bloquear novos disparos até o reset mensal (default conservador, recomendado na spec); (ii) permitir com aviso e acumular excedente não-cobrado (status quo, gera receita perdida). Decisão de negócio necessária.

**(e) Mudança de ciclo no Asaas — RESPONDIDA pela spec OpenAPI oficial:** `PUT /v3/subscriptions/{id}` suporta `cycle` + `updatePendingPayments` → tratar como atualização da assinatura existente.

**(f) (nova) Preço editável em runtime é requisito?** Hoje é código. A spec assume código versionado como fonte única (Estágio 1) com evolução opcional para tabela gerida pelo Backoffice — confirmar se essa evolução é desejada.
