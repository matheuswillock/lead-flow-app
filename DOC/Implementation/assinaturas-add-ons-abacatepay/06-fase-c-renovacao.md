# Fase C: renovação pelo roteador (M13)

Status: **backend implementado; tela pendente de aprovação do briefing**. A renovação é reativa (D8): ciclo vence, carência de 5 dias, modo somente leitura, e o master paga na página de pagamento escolhendo o prazo. Esta fase entrega o aviso por e-mail durante a carência, o corte do Asaas na confirmação do pagamento e o ajuste do prazo anterior. Nada rodou contra o AbacatePay nem o Asaas reais.

## Dependência da Fase B

Esta branch (`feature/assinaturas-fase-c-renovacao-abacatepay`) parte de `feature/assinaturas-fase-b-addons-abacatepay` e inclui o head da Fase B por merge (não fast-forward, sem reescrita de histórico). A PR da Fase B (#1414) não está mergeada em `develop`. Até ela entrar, esta branch depende dos commits da Fase B.

## O que mudou nesta fase

| Arquivo | Papel |
|---|---|
| `SubscriptionOverdueTransitionUseCase.ts`, `subscriptionOverdueTransitionComposition.ts`, rota `subscription-overdue-transition` | Marca `past_due` a conta do roteador cujo vencimento passou (D14). Cron em `vercel.json` (06:30 UTC) e em `cronStaleThresholds.ts`. |
| `lib/billing/due-date.ts` | Regra "o vencimento passou?" (data em São Paulo), compartilhada com `AccountAccessDecisionService`. |
| `lib/billing/delinquency-tier.ts` | `resolveGraceNotice`: qual aviso da carência vale em cada dia (início nos dias 0 a 3, último dia no dia 4). Não altera `resolveDelinquencyTier`. |
| `lib/billing/delinquency-reminder-copy.ts` | Texto dos dois avisos, com a data limite da carência. |
| `lib/services/EmailService.ts` | `sendDelinquencyReminderEmail` aceita os avisos da carência e a data limite. |
| `BillingEngineRepository.ts` | `findPastDueSubscriptionsInGrace` (quem está `past_due` ainda na carência). Dedupe sem `eventType`. |
| `OverdueReminderUseCase.ts` | Passo da carência antes dos degraus. Envio e dedupe compartilhados com os degraus. |
| `LegacyAsaasRenewalCutover.ts` e `legacyAsaasCutoverComposition.ts` | Corte do Asaas na renovação paga pelo roteador (D10), atrás do kill switch (D11). |
| `PaymentOwnerSettlementService.ts`, `paymentOwnerSettlementComposition.ts` | Chamam o corte depois de concluir a regularização (webhook) e repetem na reentrega. |
| `BillingGracePaymentService.ts` | Corte em melhor esforço no cartão aprovado na hora; `provider` do ledger vem do roteador (D9); cotação devolve o prazo anterior normalizado. |
| `lib/payment-provider/renewal-cycle.ts` | `normalizeRenewalCycle` (`YEARLY` vira `annual`, `SEMIANNUALLY` vira `semiannual`). |
| `lib/payment-provider/renewal-kill-switch.ts` | Ponto único de leitura de `PAYMENT_PROVIDER_RENEWAL_ENABLED`. |

Removido desta fase: o cron `provider-renewal`, o cobrador de D-5, o caso de uso de lote e a entrada em `vercel.json` e `cronStaleThresholds.ts` (D8).

## Fluxos

**Entrada na carência.** O cron `subscription-overdue-transition` (diário, antes do aviso) marca `past_due` a conta do roteador que venceu nos últimos 5 dias. Sem ele a conta ficaria `active` e cairia em `restricted` no dia seguinte, sem carência nem e-mail (D14).

**Aviso na carência.** O cron `overdue-reminder` (diário) lê quem está `past_due` com vencimento efetivo nos últimos 5 dias. Dia 0 a 3 de atraso: aviso "o período do seu plano está se encerrando". Dia 4: aviso "último dia antes do modo somente leitura". Cada aviso leva a data limite e o botão para `/billing-grace-payment`. Um por ciclo de atraso (dedupe em `SubscriptionChangeLog`).

**Pagamento da renovação.** Já existente: página de pagamento, prazos e preços do backoffice, usuários e times adicionais cotados por prazo, PIX ou cartão pelo roteador. O prazo anterior da conta vem pré-selecionado.

**Corte do Asaas.** Conta legada (assinatura recorrente no Asaas) que paga pelo roteador: ao confirmar, cancela a assinatura no Asaas e marca a conta com o provedor. Só com `PAYMENT_PROVIDER_RENEWAL_ENABLED=true`.

## Para ligar o corte do Asaas (decisão do dono)

1. A documentação do Asaas diz que remover a assinatura apaga as cobranças pendentes ou vencidas dela (D10). Confirmar no sandbox do Asaas, que não foi executado.
2. Definir `PAYMENT_PROVIDER_RENEWAL_ENABLED=true` no ambiente.

O e-mail da carência não depende disso: sai com o cron existente assim que for ao ar.

## Validação

| Verificação | Resultado |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=8192 bun run typecheck` | EXIT=0 |
| `bun test lib/payment-provider/renewal-cycle.test.ts` | EXIT=0 (2 testes) |
| `bun test lib/payment-provider/renewal-kill-switch.test.ts` | EXIT=0 (2 testes) |
| `bun test lib/billing/delinquency-tier.test.ts` | EXIT=0 (26 testes) |
| `bun test lib/billing/delinquency-reminder-copy.test.ts` | EXIT=0 (7 testes) |
| `bun test app/api/useCases/billing/OverdueReminderUseCase.test.ts` | EXIT=0 (30 testes) |
| `bun test app/api/useCases/providerRenewal/LegacyAsaasRenewalCutover.test.ts` | EXIT=0 (5 testes) |
| `bun test app/api/useCases/providerRenewal/SubscriptionOverdueTransitionUseCase.test.ts` | EXIT=0 (7 testes) |
| `bun test app/api/lib/cron/cronAuditCoverage.test.ts` | EXIT=0 (4 testes) |
| `bun test app/api/services/accountAccessDecision/AccountAccessDecisionService.test.ts` e `.bruno-regression.test.ts` | EXIT=0 (34 e 2 testes) |
| `bun test app/api/services/PaymentProviderPayment/PaymentOwnerSettlementService.test.ts` | EXIT=0 (12 testes) |
| `bun test app/api/services/BillingGracePayment/BillingGracePaymentService.test.ts` | EXIT=0 (16 testes) |
| `bun test app/api/lib/cron/cronStaleThresholds.test.ts` | EXIT=0 (9 testes) |
| `bun test app/[supabaseId]/billing-grace-payment/features/utils/billingGraceUnlimitedLoss.test.ts` | EXIT=0 (6 testes) |
| `DATABASE_URL=<Postgres local :55322> bun run test:integration:provider-renewal` | EXIT=0 (8 testes contra o Postgres local) |
| Diretórios afetados, `bun test --isolate` (serviços de pagamento, regularização e decisão de acesso; casos de uso de cobrança e renovação; cron; `lib/billing`; `lib/payment-provider`; página de regularização; repositório de cobrança) | EXIT=0 (405 testes, 59 arquivos) |
| `bun run test` (suíte oficial) | EXIT=0 (6976 testes em 1013 arquivos e 127 em 27 arquivos de UI, 0 falhas) |
| `bun run lint` | EXIT=0 (só avisos já existentes) |
| `bun run governance:check`, `check-e2e-pages`, `check-responsive`, `check-api-masking` | EXIT=0 |
| `bun run lint:pt-br:strict`, `bun run design:check` | EXIT=0 |

**Defeito achado pela integração (e corrigido).** A consulta `findPastDueSubscriptionsInGrace` excluía quem só tem a data de vencimento no perfil (o webhook do Asaas grava só a do perfil). Causa: a negação `NOT (a OR b)` do filtro dá nulo em SQL quando a data da assinatura é nula e descarta a linha. Os testes unitários não pegavam isso porque usam portas simuladas. O teste de integração ficou vermelho no código sem a correção (controle negativo) e passou depois de trocar a negação por comparações com `null` explícitas. O teste apaga o que cria (conferido: 0 linhas de teste sobrando no banco local).

Não verificado: sandbox do AbacatePay e do Asaas; e-mail renderizado e enviado de verdade; o corte no caminho do cartão aprovado na hora (sem teste dedicado); a transição por data e o corte rodando como cron/webhook de ponta a ponta; E2E; a tela completa com dados reais. O `test:integration:provider-renewal:local` falha aqui porque `local:up` tenta recriar o contêiner do banco, que já existe por outro projeto do compose; rodei o teste direto contra o banco que já estava no ar. O teste não entrou no agregado `test:integration`.

## Pendências

1. **Tela (implementada, verificada renderizada nos componentes):** aviso de perda do ilimitado ao sair do anual, com valores, controle para voltar ao anual e linha por prazo (briefing [aprovado](design/renovacao-usuarios-adicionais.md), registro em `02-frontend.md` F8). Os seis passes do `impeccable` foram executados. Falta a tela completa com dados reais.
2. **Cartão no `/checkout`:** o self-checkout ainda cobra cartão pelo Asaas. Mudança de tela, com briefing.
3. **Botão de pagar desabilitado até o aceite dos termos:** hoje o checkout barra o envio com erro de validação (D7). Mudança de tela, com briefing.
4. **Acesso das contas do roteador:** o D14 troca `restricted` imediato por carência e somente leitura para quem venceu há 1 a 5 dias. Confirmar com o dono antes do deploy.
5. **Preço por cliente (PAY-PRICING-T001):** a cotação de renovação usa só a tabela de prazos.
