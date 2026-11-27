# Backend: assinaturas e add-ons

Referência: [01-feature.md](01-feature.md) · Progresso: [04-progresso.md](04-progresso.md)

Legenda: `[x]` verificado nesta data; `[ ]` pendente. `<ref>` é `origin/feature/bloqueio-assinatura-somente-leitura` (PR) ou `HEAD` (local).

## B1. Acesso em carência por contrato (Fase A1)

**Estado:** implementado e mergeado na `develop` (PR #1381, commit `75984f629`).

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

**Estado:** implementado e mergeado na `develop` (PR #1381).

**Arquivos:** `app/api/useCases/backoffice/BackofficePlatformUsersUseCase.ts` (`resolveBackofficeAccessMode`, `resolveBackofficeHasAccess`) e `app/api/infra/data/repositories/backoffice/PlatformUsersRepository/BackofficePlatformUsersRepository.ts` (select com `subscriptionNextDueDate`, linhas 21 e 387).

- [x] B2.G1: resolver retorna `full`, `read_only` ou `none`, e o repositório seleciona `subscriptionNextDueDate`.
  - CHECK: `git grep -n "resolveBackofficeAccessMode" <ref> -- app/api/useCases/backoffice`
- [ ] B2.G2: teste de regressão dedicado para `resolveBackofficeAccessMode`.
  - EVIDENCE: o arquivo `BackofficePlatformUsersUseCase.planInfo.test.ts` referencia o resolver, mas não foi lido linha a linha para confirmar cobertura dos três estados.

## B3. Cobrança de add-on via AbacatePay (Fase B1)

**Estado:** implementado e mergeado (Fase B: PRs #1413, #1414 e #1431), a partir do commit `511941cae` e dos ajustes de `3bc6b4a8e`. A recusa de cartão sem token continua; o cartão com `ctok_` passou a ser aceito (B3.G6).

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

**Estado:** implementado e mergeado (Fase B), a partir do commit `da0e03090`.

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

- [x] B5.G1: a troca de forma é recusada quando a tentativa AbacatePay atual está `CONFIRMED` (D2).
  - CHECK: `bun test app/api/useCases/addOnCheckout/AddOnCheckoutUseCase.billingTypeSwitch.test.ts`
  - EVIDENCE: 3 testes passam isolados. Typecheck exit 0. O AbacatePay não tem cancelamento para cobrança transparente, então a cobrança anterior não é cancelada na API.
  - Risco residual em aberto: pagamento de tentativa substituída. Ver D2 em 05-decisoes.md.

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

**Estado:** parcial. `ProfileSubscription.provider` existe no schema (comentário "Fase B: rastreamento do provider de cobrança"; `null` = Asaas legado) e a Fase C o usa no corte do Asaas (D10). `BackofficePayment` não foi reverificado nesta data.

- [ ] B8.G1: campo adicionado e migrado, ou decisão registrada de não adicionar.
  - EVIDENCE: pendente.

## B9. Renovação reativa pelo roteador (Fase C)

**Estado:** implementado na branch `feature/assinaturas-fase-c-renovacao-abacatepay` em 2026-11-25, sem sandbox. A renovação é reativa (D8): ciclo vence, carência de 5 dias, somente leitura, e o master paga na página de pagamento. Não há cron de cobrança antecipada. Detalhe em [06-fase-c-renovacao.md](06-fase-c-renovacao.md). `CheckoutAsaasUseCase` (1270 linhas, todas Asaas) não foi alterado.

- [x] B9.G1: o pagamento da renovação usa o roteador e grava o provedor escolhido por ele (D9).
  - CHECK: `bun test app/api/services/BillingGracePayment/BillingGracePaymentService.test.ts`
  - EVIDENCE: EXIT=0, 16 testes. O literal `ABACATE_PAY` saiu do serviço.
- [x] B9.G2: conta do roteador vira `past_due` por data, só dentro da carência, sem reverter quem pagou (D14).
  - CHECK: `bun test app/api/useCases/providerRenewal/SubscriptionOverdueTransitionUseCase.test.ts`
  - EVIDENCE: EXIT=0, 7 testes. As consultas ao banco (`listActiveRouterSubscriptionsDueBetween`, `markPastDueIfStillDue`) passaram no teste de integração contra o Postgres local: `bun run test:integration:provider-renewal` (8 testes, ver [06-fase-c-renovacao.md](06-fase-c-renovacao.md)).
- [x] B9.G3: corte do Asaas na confirmação do pagamento, atrás do kill switch, com repetição na reentrega do evento (D10, D11).
  - CHECK: `bun test app/api/useCases/providerRenewal/LegacyAsaasRenewalCutover.test.ts` e `bun test app/api/services/PaymentProviderPayment/PaymentOwnerSettlementService.test.ts`
  - EVIDENCE: EXIT=0, 5 e 12 testes. O caminho do cartão aprovado na hora não tem teste dedicado.
- [ ] B9.G4: validação em sandbox do AbacatePay (aprovação e recusa) e do Asaas (cancelamento remove cobranças pendentes).
  - EVIDENCE: pendente. A documentação do Asaas confirma o comportamento, mas o sandbox não foi executado.
- [x] B9.G5: cartão na renovação e no `/checkout` já passa pelo AbacatePay. Esta pendência estava errada e foi retirada em 2026-11-26.
  - EVIDENCE: a rota `app/api/v1/public-adhesions/[token]/card/route.ts` cobra "pelo Abacate (cartão transparente)" e só aceita o token `ctok_`; a oferta de cartão do `/checkout` vem de `resolveCardCheckout` (`provider: "ABACATE_PAY"`, só com cartão ligado e chave pública configurada); a renovação já tinha cartão pelo roteador. O comentário na linha 48 de `SelfCheckoutUseCase.ts` ("o cartão é cobrado pelo Asaas") só trata do portão da criação do pedido e induziu a nota errada. O comentário continua desatualizado no código.

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

**Estado:** parcial. `OverdueReminderUseCase` existe. Os textos e a faixa de cada degrau vêm de `lib/billing/delinquency-tier.ts`, que ainda usa janelas fixas. Em 2026-11-25 a Fase C acrescentou os dois avisos da carência (D12): início (dias 0 a 3) e último dia (dia 4), com dedupe por ciclo e link para `/pagamento/[supabaseId]` (antes da D15 era `/billing-grace-payment`).

- [x] B12.G0: os avisos da carência saem uma vez por ciclo, com a data limite e o link do pagamento.
  - CHECK: `bun test app/api/useCases/billing/OverdueReminderUseCase.test.ts` e `bun test lib/billing/delinquency-tier.test.ts`
  - EVIDENCE: EXIT=0, 30 e 26 testes (6 do aviso da carência no caso de uso, 4 da regra dos dias). A consulta `findPastDueSubscriptionsInGrace` passou na integração contra o Postgres local, depois de corrigir um defeito de nulos (ver [06-fase-c-renovacao.md](06-fase-c-renovacao.md)). O e-mail não foi renderizado nem enviado de verdade.
- [ ] B12.G1: e-mail vai ao responsável financeiro correto, com um único envio em duas execuções do cron.
  - EVIDENCE: pendente. Hoje o destinatário é o e-mail do perfil da assinatura (`profile.email`). Não foi confirmado que ele é o responsável financeiro.

## B13. Confirmação de time agnóstica e conta Asaas nullable

Ação com provedor (`provider` preenchido) não tem conta Asaas: `corretor_studio_pending_actions."asaasAccount"` passa a ser nullable (migration `20261125090000`, idempotente; não altera dados — ações de provedor já gravadas mantêm `primary`, que o código ignora quando há provedor). `ConfirmTeamPaymentUseCase` confirma ação de provedor consultando o próprio provedor via `PendingActionProviderPaymentService` (`PaymentQueryCapability.getStatus`, provedor resolvido pela chave da tentativa); só `CONFIRMED` com valor conferido aplica, pela mesma liquidação do webhook (`PaymentOwnerSettlementService`, idempotente). Pendente, `UNKNOWN` ou erro do provedor devolvem falha sem aplicar. Ação sem provedor mantém o caminho Asaas, isolado em `confirmLegacyAsaasAction`.

- [ ] B13.G1: confirmação de time por ação de provedor aplica só quando o provedor confirma e o valor confere.
  - EVIDENCE: testes `ConfirmTeamPaymentUseCase.providerAction.test.ts` e `PendingActionProviderPaymentService.test.ts`. Execução da integração pendente.

## B14. Checkouts logados fora do shell: sessão obrigatória e rota nova (D15, D16)

**Estado:** implementado e mergeado (commits `1e6a8a88c`, `572020153`; PR #1431), 2026-11-26.

**Arquivos:**
- `lib/proxy/route-access.ts`: `SESSION_REQUIRED_PAGE_PREFIXES` (`/pagamento/` e `/addon-checkout/`) alimenta `requiresSessionPage`; `/addon-checkout` saiu das rotas públicas; `resolveLegacyBillingGracePaymentPath` devolve `/pagamento/{id}` para a rota antiga `/{id}/billing-grace-payment`.
- `proxy.ts`: responde 308 para o caminho de `resolveLegacyBillingGracePaymentPath`, antes da checagem de autenticação; sem sessão em página de sessão obrigatória, redireciona para `/sign-in?next=<caminho>`.
- `lib/supabase/server-session-user.ts`: `getServerSessionUserId` resolve o usuário logado no servidor. Aceita o cookie assinado do E2E (`resolveE2eUser`), como o bootstrap da conta, e cai no Supabase (`auth.getUser`) quando não há cookie de teste.
- `app/pagamento/[supabaseId]/page.tsx` e `app/addon-checkout/[pendingActionId]/page.tsx`: usam o helper. A regularização manda o não dono ao próprio dashboard.
- Links que passaram a apontar para `/pagamento/[supabaseId]`: `getPaymentRecoveryHref` (banner, painel, modo leitura, gate), a página de assinatura (`SubscriptionContainer.tsx`) e o e-mail de inadimplência (`OverdueReminderUseCase.ts`). `accountAccessReadOnly.ts` e `accountAccessRecovery.ts` passaram a reconhecer o novo caminho.

- [x] B14.G1: `/pagamento/` e `/addon-checkout/` exigem sessão e `/addon-checkout` não é público.
  - CHECK: `bun test lib/proxy/route-access.test.ts proxy.test.ts`
  - EVIDENCE: testes novos de `requiresSessionPage` (checkout, add-on, rotas parecidas que não entram) e de `resolveLegacyBillingGracePaymentPath`. Execução local em 2026-11-26 junto de outras áreas: 119 testes, 0 falhas. O job `ci / CI Light (VPS)` do run 45828436193 terminou com sucesso.
- [x] B14.G2: a rota antiga redireciona e o caminho novo exige sessão, de ponta a ponta.
  - CHECK: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3200/<id>/billing-grace-payment` e a mesma chamada em `/pagamento/<id>` e em `/addon-checkout/<id>` sem sessão
  - EVIDENCE: 308 para `/pagamento/<id>`; 307 para `/sign-in?next=%2Fpagamento%2F<id>`; 307 para `/sign-in?next=%2Faddon-checkout%2F<id>`. Verificado em 2026-11-26, no servidor local.
- [x] B14.G3: a sessão de teste do E2E é reconhecida pelas páginas novas.
  - EVIDENCE: a primeira execução da pipeline falhou em 13 testes porque as páginas liam só o Supabase; depois de `getServerSessionUserId` (`572020153`), as falhas de sessão sumiram (restou a de alvo de toque do "Sair", corrigida em `38595f69a`).
- [ ] B14.G4: a API do add-on exige que o usuário pertença ao time da cobrança.
  - EVIDENCE: pendente. `GET /api/v1/addon-checkout/[pendingActionId]` continua acessível pelo id (D16).
