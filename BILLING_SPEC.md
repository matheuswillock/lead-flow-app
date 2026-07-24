# BILLING_SPEC.md — Spec canônica de billing v2.0

**Versão:** 2.0  
**Data:** 2026-07-24  
**Base:** [`BILLING_AUDIT.md`](BILLING_AUDIT.md) (reauditoria 24/07 + inventário §3A)  
**Substitui:** `BILLING_SPEC.md` v1.0 (superseded) e `BILLING_ENGINE_SPEC.md` (removido).

---

## Goal

Motor de cobrança com **uma única estrutura de dados** (catálogo no banco + `ProfileSubscription` canônico), webhook alinhado ao Asaas real, segurança de borda (RLS + vitalício só Backoffice), cancelamento/refund reais, **migração completa** de todos os clientes para o modelo novo (sem legado permanente), **mudança entre quaisquer níveis** de assinatura, precificação multi-slug com parcelas iguais ou custom, entitlements unificados, e alertas de cobrança — com aceite por estágio e testes nas transições de risco.

## Non-goals

- Trocar PSP (permanece Asaas).
- Unificar `EmailCreditSubscription` / Dialer dentro da assinatura Profile (permanecem módulos separados, mesmo gate).
- Resolver todas as inconsistências comerciais de `PRICING_TABLE.md` / Radar (decisões de negócio à parte).
- Manter System A / `crm-legacy` / literais de preço após o cutover.
- Aplicar migration remota sem autorização explícita do owner.

---

## Decisões arquiteturais

### D0 — RLS (C-1)
`asaas_webhook_events`, `profile_user_types`, `profile_user_type_assignments`: ENABLE RLS + policies mínimas. Investigar grants em produção antes do push. Pré-requisito de segurança.

### D1 — Preço só no banco
Fonte única: `BackofficeProduct` + `BackofficeProductPaymentRule` (padrão `adhesion-pricing.ts`). **Proibido** `pricingCatalog.ts` ou literais 59,90/19,90/29,90 no app após Estágio 6.

### D2 — `SubscriptionCycle` enum
`MONTHLY | QUARTERLY | SEMIANNUALLY | YEARLY`. Migration normaliza case (`quarterly` → `QUARTERLY`). Vitalício ≠ ciclo (é flag / produto lifetime).

### D3 — Não forçar `manager_base`
Webhook/`updateProfileStatus` não sobrescrevem `subscriptionPlan` incondicionalmente (C3).

### D4 — Billing por módulo
Assinatura principal (Asaas) + Email credits (por Team) + Dialer: modelos separados, **um** feature gate (`FeatureAccessService`).

### D5 — Vocabulário Asaas real (C0)
Eventos: `SUBSCRIPTION_CREATED|UPDATED|INACTIVATED|DELETED`. Status payload: `ACTIVE|EXPIRED|INACTIVE`. Remover eventos inventados. Sem fallback `?? 'active'`. Handlers refund/chargeback. Inadimplência prolongada → `PUT` Asaas `INACTIVE`.

### D6 — Vitalício só Backoffice (C1/C1b)
Remover rota pública; PUT produto exige `getBackofficeAccess()`. Log de quem alterou.

### D7 — `SubscriptionChangeLog`
Toda mudança de nível/plano/ciclo/valor/vitalício/cancelamento: de-para JSON + source + actor.

### D8 — Entitlements unificados
`ACTIVE_SUBSCRIPTION_STATUSES` compartilhado. `SubscriptionCheck` + bootstrap leem **ProfileSubscription** (+ produtos/capacidades), não só Profile. Expor `productSlugs` / `featureSlugs` / capacidades.

### D9 — Mudança de ciclo = PUT Assas
`PUT /v3/subscriptions/{id}` com `cycle` + `updatePendingPayments`. Sem cancelar+recriar.

### D10 — Desconto % por adesão
Override só em `BackofficeAdhesion`; teto em config; acima do teto → aprovação autenticada MANAGER/MASTER (rota dedicada). Catálogo nunca escrito pelo desconto.

### D11 — Motor de mudança de nível (genérico)
Transicionar conta entre **quaisquer** níveis suportados: `ProfileUserType` + produtos do catálogo + capacidades. Exemplos: `common` → `member_pro` → plano pago; `associate`; vitalício; upgrade/downgrade de pack. Por transição: reconciliar Asaas vs catálogo, entitlements, ChangeLog.  
Casos especiais (ex. expiração Member PRO): gatilho `after()` no bootstrap + cron rede de segurança — **instâncias** do motor, não o modelo inteiro.

### D12 — P-MS multi-slug + parcelas
- Produto: `featureSlugs String[]` (1..N).
- Payment rule cartão: `installmentSplitMode EQUAL|CUSTOM`; EQUAL → `maxInstallments`; CUSTOM → `installmentSchedule` (soma = price); checkout: à vista **ou** schedule fixo.
- Asaas: EQUAL → `installmentCount`/`installmentValue`; CUSTOM → **N cobranças avulsas**.

### D13 — Cutover estrutural sem legado
Migrar **todas** as assinaturas/preços/capacidades System A → modelo novo. Dry-run + reconciliação Asaas. Remover literais só após cutover validado. Rollback documentado. Sem push remoto sem auth.

### D14 — Fonte única de assinatura (audit §3A)
Canônico: `ProfileSubscription` + `BackofficeUserSubscription` + `ProfileSubscriptionCapacity` + `ProfileUserTypeAssignment`.  
Profile: identidade + `asaasCustomerId`; campos de assinatura espelhados **descontinuados** pós-cutover. Nenhum fluxo novo faz dual-write “legacy compatibility”.

---

## Estágios de implementação

Ordem obrigatória. Cada estágio: `typecheck`, `lint`, `governance:check` (+ `design:check` se UI). Migration remota só com auth do owner.

```mermaid
flowchart TD
  S0["-1 RLS D0"] --> S1["0 Vitalicio D6"]
  S1 --> S2["1 Webhook D5"]
  S2 --> S3["2 Cancelamento C2"]
  S3 --> S4["3 Sem manager_base D3"]
  S4 --> S5["4 Schema D12+D14"]
  S5 --> S6["5 Cutover D13"]
  S6 --> S7["6 Remover literais e espelho Profile"]
  S7 --> S8["7 Cycle enum D2 + ChangeLog D7"]
  S8 --> S9["8 Entitlements D8"]
  S9 --> S10["9 UI Backoffice auth"]
  S10 --> S11["10 Desconto D10"]
  S11 --> S12["11 Motor niveis D11"]
  S12 --> S13["12 Dunning emails"]
```

---

### Estágio -1 — RLS (D0 / C-1)

**Fazer:**
1. MCP/SQL somente leitura: grants `anon`/`authenticated` nas 3 tabelas.
2. `bun run db:migrate:new fix-billing-tables-rls` — ENABLE RLS + policies idempotentes (`DROP POLICY IF EXISTS`).
   - `asaas_webhook_events`: sem policy permissiva (só service role).
   - `profile_user_types`: SELECT authenticated OK; escrita não.
   - `profile_user_type_assignments`: leitura própria / backoffice; escrita só service role.
3. Não `db:migrate:push` sem auth do owner.
4. Validar local: `db:migrate:reset:local` + rotas Prisma ok.

**Aceite:** migration revisada; grants documentados no PR.

---

### Estágio 0 — Vitalício só Backoffice (D6 / C1 / C1b)

**Fazer:**
1. DELETE `app/api/v1/profiles/permanent-subscription/route.ts` (+ use case se órfão).
2. PUT `profiles/[supabaseId]/permanent-subscription`: `getBackofficeAccess()`; remover UI produto se usar a rota.
3. Gravar em ProfileSubscription **e** Profile só se ainda no período pré-Estágio 6; preferir ProfileSubscription se já existir.
4. `console.info` estável + ator; Postman; testes auth (backoffice OK; sem auth / master produto negados).

**Aceite:** POST pública 404; PUT sem backoffice 403.

---

### Estágio 1 — Webhook Asaas real (D5 / C0)

**Fazer:**
1. `PaymentValidationService` + `processAsaasWebhookEvent`: só eventos reais; mapear `INACTIVE`→suspended, `EXPIRED`→canceled; **sem** `?? 'active'`.
2. Handlers `PAYMENT_REFUNDED` / parcial / `CHARGEBACK_*` (parcial ≠ past_due automático sem regra).
3. Inadimplência prolongada (ex. 15 dias `past_due`) → `PUT` Asaas `INACTIVE`.
4. Testes de mapeamento + regressão eventos inventados.

**Não tocar:** preços, schema além do necessário.

**Aceite:** sandbox `SUBSCRIPTION_UPDATED`+`INACTIVE` → suspended local; estorno tratado.

---

### Estágio 2 — Cancelamento / cartão / retry reais (C2 / C2b)

**Fazer:**
1. `cancelSubscription`: chamar Asaas `DELETE`/`cancel` **antes** de marcar local; fail-closed se Asaas falhar.
2. Implementar ou retornar `Output(false)` em `updatePaymentMethod` / `retryPayment` (nunca sucesso mentiroso).
3. Criar rota `POST .../subscription-management/invoices/retry` se o frontend depender dela.
4. ChangeLog de cancelamento (pode stub até Estágio 7 se tabela ainda não existir — preferir criar ChangeLog cedo ou registrar TODO bloqueante).

**Aceite:** cancelar em sandbox remove cobrança futura no Asaas; UI não mostra sucesso falso.

---

### Estágio 3 — Parar `manager_base` forçado (D3 / C3)

**Fazer:** Remover hardcode em `PaymentValidationService` (~130, ~337) e handlers irmãos. Preservar plano existente; derivar só se nulo (`operatorCount > 0 ? with_operators : manager_base` no modelo legado até cutover).

**Aceite:** renovação não regride `with_operators`.

---

### Estágio 4 — Schema alvo: P-MS + D14 (D12 / D14)

**Fazer:**
1. `BackofficeProduct.featureSlugs String[]` — backfill de `featureSlug`; dropar coluna singular após callers.
2. `BackofficeProductPaymentRule`: `installmentSplitMode`, `installmentSchedule Decimal[]?`.
3. Validação use case: slugs ≥1 existem em `BackofficeFeature`; CUSTOM soma = price.
4. UI [`BackofficeProductDialog`](app/backoffice/(app)/pricing/features/components/BackofficeProductDialog.tsx): multi-select slugs; toggle iguais vs custom.
5. API pricing + Postman; `adhesion-pricing` / AdhesionService consomem EQUAL vs CUSTOM (N cobranças avulsas).
6. Documentar no PR o inventário §3A: lista de writers a migrar no Estágio 5–6 (sem dual-write novo).

Migration: `bun run db:migrate:from-prisma -- pricing-multi-slug-installments` (+ dados se preciso).

**Aceite:** criar produto com 2+ slugs; CUSTOM bloqueia save se soma ≠ total; checkout EQUAL 1..max / CUSTOM só à vista|schedule.

---

### Estágio 5 — Cutover de dados (D13)

**Fazer:**
1. Inventário produção/sandbox: profiles com assinatura Asaas, valores, ciclos, add-ons, flags, user types.
2. Script/migration idempotente + **dry-run**: mapear cada conta → ProfileSubscription + BackofficeUserSubscription(s) + Capacity + productIds do catálogo novo.
3. Reconciliar `asaas.value` vs catálogo (alertar anomalias tipo 5990).
4. Copiar campos de assinatura de Profile → ProfileSubscription onde faltar; unificar `hasPermanentSubscription`.
5. Não remover literais ainda.

**Aceite:** dry-run report revisado pelo owner; cutover local/staging verde; contagem ProfileSubscription = masters com assinatura.

---

### Estágio 6 — Remover literais e espelho Profile (D1 / D14)

**Fazer:**
1. Helper único `resolvePrice(featureSlug|productId, cycle, method)` via banco.
2. Substituir todos os literais listados no audit §3.1.
3. Writers (PaymentRepository, AsaasSubscriptionSync, Checkout, webhook, SubscriptionManagement, etc.): **só** ProfileSubscription (+ produtos/capacity); Profile deixa de receber status/plano/Asaas subscription id/cycle/datas de assinatura.
4. Readers: SubscriptionCheck / FeatureAccess / sync usam ProfileSubscription; remover fallbacks OR legados.
5. UI: sem fallback 59,9 — Skeleton se API falhar.
6. Teste/grep: `59\.9|19\.9|29\.9` só fora de app (ou zero em `app/`).

**Aceite:** grep limpo; dual-write removido; check e feature access alinhados.

---

### Estágio 7 — Cycle enum + ChangeLog (D2 / D7)

**Fazer:** enum Prisma + migration com normalização de case; model `SubscriptionChangeLog`; instrumentar cancel/nível/ciclo/vitalício/webhook.

**Aceite:** typecheck rejeita string livre; log gravado em mudança de teste.

---

### Estágio 8 — Entitlements (D8)

**Fazer:** export único `ACTIVE_SUBSCRIPTION_STATUSES`; `SubscriptionCheckService` alinhado; resposta com `productSlugs` / `featureSlugs` / capacidades; add-ons multiplicáveis exigem capacity > 0; bootstrap reutiliza o mesmo contrato.

**Aceite:** trial/past_due: sidebar e página coerentes; payload de check contém slugs.

---

### Estágio 9 — UI / auth Backoffice

**Fazer:** `requireManagerAccess` em `POST .../backoffice/payments`; remover ou implementar noop de fatura; AlertDialog vitalício; scroll em dialogs de cobrança; Postman se contrato mudar.

**Aceite:** operador não cria cobrança via API; sem botões financeiros mortos.

---

### Estágio 10 — Desconto por adesão (D10)

**Fazer:** campos em `BackofficeAdhesion` + teto config; `discountPercent` no cálculo; rota `approve-discount` com profile da sessão; UI preço tabela vs negociado.

**Aceite:** acima do teto fica pending até aprovação autenticada; catálogo intocado.

---

### Estágio 11 — Motor de mudança de nível (D11)

**Fazer:**
1. Use case Backoffice: `transitionSubscriptionLevel(profileId, target)` — target = user type e/ou set de productSlugs/capacidades.
2. Regras: validar dados Asaas se a transição inicia/altera cobrança; atualizar Assignment + UserSubscriptions + Capacity + ProfileSubscription; sync valor Asaas via catálogo; ChangeLog.
3. Casos especiais: expiração `member_pro` → plano pago via `after()` no bootstrap + cron; aviso na concessão sem cadastro.
4. Testes: common→member_pro; member_pro→crm pago; downgrade; vitalício.

**Aceite:** qualquer transição suportada documentada funciona ponta a ponta em sandbox; Member PRO não é o único path.

---

### Estágio 12 — Dunning / e-mails

**Fazer:** cron overdue-reminder (padrão CRON_SECRET do member-pro); reduzir dependência de botão manual; falhas de e-mail/billing no Sentry; copy distinta primeira cobrança vs renovação.

**Aceite:** conta past_due recebe e-mail automático na janela configurada.

---

## Critérios de aceite globais (pós todos os estágios)

- [ ] Sem rota pública de vitalício; vitalício só backoffice.
- [ ] Webhook só vocabulário Asaas real; sem reativação por fallback.
- [ ] Cancelamento reflete no Asaas.
- [ ] Preço só no banco; zero literais System A em `app/`.
- [ ] ProfileSubscription canônico; sem dual-write de assinatura no Profile.
- [ ] P-MS: multi-slug + EQUAL/CUSTOM no cadastro e no checkout.
- [ ] Cutover: 100% contas no modelo novo.
- [ ] Mudança entre quaisquer níveis suportados + ChangeLog.
- [ ] Entitlements únicos (check ≡ feature access quanto a “ativo”).
- [ ] RLS staging/prod conforme auth do owner.

## Apêndice — débitos (não bloqueiam D13/D14)

- Timeout em `asaasFetch`; índices `Profile.asaasCustomerId` (se ainda usados para customer).
- Overage e-mail opt-in (bloquear sem cartão — default).
- Performance bootstrap / cache feature access.
- Testes dedicados webhook/PaymentValidation (obrigatórios nos estágios 1–2, expandir depois).
