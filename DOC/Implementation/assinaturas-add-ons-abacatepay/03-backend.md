# Backend: assinaturas e add-ons

Referência: [01-feature.md](01-feature.md) · Progresso: [04-progresso.md](04-progresso.md)

Legenda: `[x]` verificado nesta data; `[ ]` pendente. `<ref>` é `origin/feature/bloqueio-assinatura-somente-leitura` (PR) ou `HEAD` (local).

## B1. Acesso em carência por contrato (Fase A1)

**Estado:** implementado no PR (commit `75984f629`). Ausente na `origin/develop`.

**Arquivo:** `app/api/services/featureAccess/FeatureAccessService.ts`

- `isGenericBillingGrace`: carência de cobrança (dentro ou fora do prazo), sem exigir Member PRO nem CRM.
- `accountSubscriptionActive` inclui esse caso em OR com `memberProGraceOverride`.
- O gate `memberProGraceOverride && feature.slug !== "crm"` (linha 371) foi mantido de propósito. Ele só vale para o caso Member PRO + CRM do PR #1395.
- Os slugs liberados na carência são os de `paidProductSlugs`.
- `mode: "full" | "read_only"` retornado por `IFeatureAccessService` (já no PR).

- [x] B1.G1: carência genérica libera slugs contratados.
  - CHECK: `bun test app/api/services/featureAccess/FeatureAccessService.readOnlyWindow.test.ts` (no ref do PR)
  - EVIDENCE: teste "carência genérica" presente (linha 101) e `mode` verificado nos testes (linhas 132 a 171).
- [x] B1.G2: carência expirada resulta em `read_only`; `suspended` e `canceled` ficam sem acesso.
  - EVIDENCE: testes das linhas 135 e 153 do mesmo arquivo.
- [ ] B1.G3: regressão Member PRO + CRM do PR #1395 coberta.
  - EVIDENCE: não confirmado nesta análise.
- [ ] B1.G4: comportamento verificado com dados reais de produção, em especial contas sem `subscriptionNextDueDate`.
  - EVIDENCE: pendente.

## B2. Resolver tri-estado do backoffice (Fase A2)

**Estado:** implementado no PR. Ausente na `origin/develop`.

**Arquivos:** `app/api/useCases/backoffice/BackofficePlatformUsersUseCase.ts` (`resolveBackofficeAccessMode`, `resolveBackofficeHasAccess`) e `app/api/infra/data/repositories/backoffice/PlatformUsersRepository/BackofficePlatformUsersRepository.ts` (select com `subscriptionNextDueDate`, linhas 21 e 387).

- [x] B2.G1: resolver retorna `full`, `read_only` ou `none`, e o repositório seleciona `subscriptionNextDueDate`.
  - CHECK: `git grep -n "resolveBackofficeAccessMode" <ref> -- app/api/useCases/backoffice`
- [ ] B2.G2: teste de regressão dedicado para `resolveBackofficeAccessMode`.
  - EVIDENCE: o arquivo `BackofficePlatformUsersUseCase.planInfo.test.ts` referencia o resolver, mas não foi lido linha a linha para confirmar cobertura dos três estados.

## B3. Cobrança de add-on via AbacatePay (Fase B1)

**Estado:** implementado localmente (commit `511941cae`), com ajustes em `3bc6b4a8e`. Não está no PR nem na origin.

**Arquivo:** `app/api/services/billing/IncrementalBillingService.ts`, método `createIncrementalCharge`.

- Recusa `billingType` ausente e `CREDIT_CARD`, antes de qualquer escrita. Motivo: o AbacatePay exige token de cartão do checkout, e o número cru não pode ser enviado.
- Para PIX: escolhe o provider pelo router, cria `PaymentProviderSession` e `Attempt`, adquire lease e chama `provider.createPixPayment`.
- Registra provider, ambiente, sessão e tentativa no `PendingAction` via `attachProviderAttempt`.
- Não chama Asaas em nenhum momento do fluxo.
- Migration das colunas `provider*`: criada em `fecc6af3f` (`supabase/migrations/20261117120000_corretor_studio_pending_action_provider.sql`). Não aplicada.

- [x] B3.G1: PIX de add-on vai ao AbacatePay e não toca o Asaas.
  - CHECK: `bun test app/api/services/billing/IncrementalBillingService.account-routing.test.ts`
  - EVIDENCE: 3 testes do arquivo passam isolados (T-40.4 PIX, T-40.5 cartão recusado, T-40.6 a T-40.8).
- [x] B3.G2: cartão recusado antes de criar sessão, tentativa ou chamada ao provider.
  - EVIDENCE: teste T-40.5.
- [ ] B3.G3: cobrança PIX real no sandbox da AbacatePay.
  - EVIDENCE: pendente. Requer credencial de sandbox e autorização explícita.
- [x] B3.G4: decisão sobre cartão de add-on.
  - EVIDENCE: decidido em 2026-11-17 (opção a): o cartão é tokenizado no navegador com `abacatepay.js` e o backend recebe só o `ctok_`. Ver [05-decisoes.md](05-decisoes.md), D1.
- [x] B3.G6: backend aceita `cardToken` (`ctok_`) e cobra pelo AbacatePay. `creditCard` (número e CVV) saiu do contrato do use case, da interface e da rota de pagamento.
  - CHECK: `bun test app/api/services/billing/IncrementalBillingService.account-routing.test.ts`
  - EVIDENCE: 7 testes passam isolados, incluindo T-40.5 (sem token, recusa antes de escrever) e T-40.9 (com `ctok_`, chama `createCardPayment` com o token e sem Asaas). Typecheck exit 0 em 2026-11-17. Lint sem erros.
  - Falta: o formulário do front ainda envia o cartão. Ver F7.
- [ ] B3.G5: migration aplicada no banco de desenvolvimento pela pipeline.
  - EVIDENCE: pendente. Só após o merge na develop, conforme o protocolo do projeto.

## B4. Consulta de status de add-on (Fase B2)

**Estado:** implementado localmente (commit `da0e03090`).

**Arquivo:** `app/api/useCases/addOnCheckout/AddOnCheckoutUseCase.ts`, método `checkPaymentStatus`.

- Ramifica por `pendingAction.provider`. `ABACATE_PAY` lê a tentativa em `paymentProviderSessionRepository.findAttemptById(providerAttemptId)`. Asaas mantém o fluxo anterior.
- `paymentId` derivado de `provider-<providerExternalId>` quando a ação é AbacatePay.
- Quando confirmada, aplica pelo novo `pendingActionUseCase.applyPendingActionById(id)`.
- `applicablePendingActionSelect` passou a trazer `provider`, `providerAttemptId` e `providerExternalId`. Sem isso, o ramo AbacatePay nunca executaria.

- [x] B4.G1: CONFIRMED aplica por id, sem consultar Asaas; PENDING não aplica; tentativa ausente retorna erro.
  - CHECK: `bun test app/api/useCases/addOnCheckout/AddOnCheckoutUseCase.checkPaymentStatus.test.ts`
  - EVIDENCE: 5 testes passam isolados.
- [x] B4.G2: typecheck do estado final.
  - CHECK: `bun run typecheck`
  - EVIDENCE: exit 0 em 2026-11-17.

## B5. Troca de forma de pagamento (`updateBillingType`)

**Estado:** sem alteração.

Motivo: AbacatePay não grava `paymentId` na ação. O bloco que cancela a cobrança Asaas só roda quando há `paymentId`, então é ignorado para add-on AbacatePay. Trocar PIX por cartão depois de gerar PIX deixa a cobrança PIX aberta no AbacatePay, o que é um risco de cobrança dupla. Ver [04-progresso.md](04-progresso.md), decisões pendentes.

- [ ] B5.G1: ao trocar PIX por cartão, ou cartão por PIX, a cobrança anterior é cancelada no AbacatePay antes da nova ser criada (decisão D2).
  - EVIDENCE: decidido em 2026-11-17, não implementado. O cancelamento usa a tentativa atual (`providerAttemptId`).

## B6. Webhook do AbacatePay para ação pendente

**Estado:** não iniciado. Hoje a confirmação depende só do polling de `checkPaymentStatus`.

- [x] B6.G1: liquidação de `PENDING_ACTION_ADDON` aplica a ação quando o valor confere, e recusa valor divergente ou ausente.
  - CHECK: `bun test app/api/services/PaymentProviderPayment/PaymentOwnerSettlementService.test.ts`
  - EVIDENCE: 10 testes passam, incluindo 5 de add-on. Typecheck exit 0 em 2026-11-17. A checagem de valor compara com `payload.totalCharge` da ação.
  - Falta: o fluxo completo do webhook do AbacatePay até essa liquidação não foi executado de ponta a ponta. Só os testes unitários do serviço passaram.

## B7. Reconciliação de estados UNKNOWN para `PENDING_ACTION_ADDON`

**Estado:** não iniciado. A string `PENDING_ACTION_ADDON` só aparece em `IncrementalBillingService.ts`.

- [ ] B7.G1: `PaymentProviderReconciliationService` resolve tentativas `UNKNOWN` desse owner.
  - EVIDENCE: pendente.

## B8. Campo `provider` em `BackofficePayment` e `ProfileSubscription` (Fase B)

**Estado:** não encontrado no schema. O plano pede o campo, mas ele não existe nos modelos citados.

- [ ] B8.G1: campo adicionado e migrado, ou decisão registrada de não adicionar.
  - EVIDENCE: pendente.

## B9. Assinatura e renovação via router (Fase C)

**Estado:** não iniciado. `app/api/useCases/subscriptions/CheckoutAsaasUseCase.ts` tem 1270 linhas, todas Asaas.

- [ ] B9.G1: renovação via router, com cron e idempotência.
  - EVIDENCE: pendente. Validação só em sandbox, com kill switch.

## B10. Ações de fatura do backoffice (Fase D)

**Estado:** não iniciado no backend. O cancelamento já existe: `deleteMasterUserInvoice` (ver F2).

- [ ] B10.G1: rota e UseCase de "Marcar como paga externamente", separados do waive.
  - EVIDENCE: pendente.
- [ ] B10.G2: fatura Asaas pendente tem a cobrança remota cancelada antes da baixa local.
  - EVIDENCE: pendente.

## B11. Página de assinatura restrita na API (Fase E)

**Estado:** não verificado. Ver F4.

- [ ] B11.G1: API nega acesso a quem não é master nem delegado.
  - EVIDENCE: pendente.

## B12. Alertas de inadimplência (Fase F)

**Estado:** não verificado. `OverdueReminderUseCase` existe. Os textos e a faixa de cada degrau vêm de `lib/billing/delinquency-tier.ts`, que ainda usa janelas fixas.

- [ ] B12.G1: e-mail vai ao responsável financeiro correto, com um único envio em duas execuções do cron.
  - EVIDENCE: pendente.
