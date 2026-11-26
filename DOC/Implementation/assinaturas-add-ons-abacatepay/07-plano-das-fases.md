# Plano das fases: assinaturas e add-ons

Estado em 2026-11-26. As fases A, B e C estão entregues e mergeadas na `develop`. As fases D, E, F e G continuam pendentes.

Referências: [01-feature.md](01-feature.md) · [05-decisoes.md](05-decisoes.md) · [spec-backend.md](spec-backend.md) · [spec-frontend.md](spec-frontend.md) · [03-backend.md](03-backend.md) · [02-frontend.md](02-frontend.md) · [04-progresso.md](04-progresso.md) · [06-fase-c-renovacao.md](06-fase-c-renovacao.md)

Este documento recria o plano original (colado em 2026-11-17, com as fases A a G e o bloco de validação) e o atualiza com o que foi entregue. Cada afirmação de estado cita PR, commit ou comando. Onde não há prova, o texto diz "Não verificado".

## Contexto

A feature nasceu de quatro problemas:

1. **Acesso indevido em carência.** Contas em carência sem Member PRO ficavam bloqueadas por completo (leitura e escrita). O correto é manter acesso total durante a vigência e cair para leitura em tudo que a conta já contratou depois da carência, nunca bloqueio total. Caso observado: You Pop Corretora de Seguros. O PR [#1395](https://github.com/matheuswillock/lead-flow-app/pull/1395) (mergeado em 2026-11-16) corrigiu só o caso Member PRO + CRM.
2. **Cobrança nova ia para o Asaas.** Add-ons (time, usuário/licença, créditos) e assinatura precisam ir para o AbacatePay, sem fallback para o Asaas, inclusive em contas legadas.
3. **Backoffice sem gestão de faturas.** Faltam "Cancelar" e "Marcar como paga externamente" nas faturas pendentes, nunca visíveis ao cliente final.
4. **Página de assinatura aberta a qualquer usuário.** Deve ser restrita a master e delegados.

O que o código já tinha antes da feature e foi reaproveitado, em vez de reconstruído:

- Abstração de provider em `lib/payment-provider/` (`AbacatePayProvider`), em produção para self-checkout e créditos de e-mail.
- Bloqueio de escrita central em `app/api/v1/utils/teamAccess.ts`, que nega mutação quando `AccountAccessDecisionService.decide()` devolve `read_only`.
- Alerta de inadimplência genérico em `app/api/useCases/billing/OverdueReminderUseCase.ts`, com dedupe.
- Cancelamento de fatura no backoffice: `BackofficePlatformUsersUseCase.deleteMasterUserInvoice`.

## Decisões de produto fechadas

Detalhe e motivo em [05-decisoes.md](05-decisoes.md).

- Ações de fatura (cancelar, marcar paga externamente) existem só no backoffice.
- Migração de provider em duas etapas: add-ons primeiro (B), assinatura por último (C, maior risco financeiro).
- "Marcar como paga externamente" usa campo novo e separado do waive. Não reutiliza `forceApplyPendingActionWithoutCharge`.
- Add-ons são time, usuário/licença e créditos.
- Fase A libera leitura em tudo que o time já tinha contratado, sem lista fixa de módulos.
- Página de assinatura usa `isMaster || canManageAccountTeams`, sem campo novo em `TeamMember`.
- Divergência deliberada da Decisão 13 da spec antiga do Obsidian: todo pagamento novo, inclusive de conta legada, vai para o AbacatePay (D4).
- Toda tela afetada passa pelo briefing `impeccable shape` antes do JSX e pela revisão `impeccable` depois.

## Visão geral

| Fase | Escopo | Estado | Evidência |
| --- | --- | --- | --- |
| A | Acesso em carência por contrato, badge tri-estado do backoffice, "Cancelar" fatura | Implementado | PR [#1381](https://github.com/matheuswillock/lead-flow-app/pull/1381) mergeado em 2026-11-18T17:49Z |
| B | Add-ons e cobrança avulsa pelo AbacatePay, sem fallback Asaas | Implementado, sem sandbox | PRs #1408, #1413, #1414 e #1431 mergeados (último em 2026-11-26T15:06Z) |
| C | Renovação reativa pelo roteador, carência, corte do Asaas | Implementado, sem sandbox | PR [#1432](https://github.com/matheuswillock/lead-flow-app/pull/1432) mergeado em 2026-11-26T18:23Z |
| Regularização (A e C) | Botão no painel bloqueado, checkout em tela própria, confirmação com contador | Implementado | Commits `039ba5d15`, `1e6a8a88c`, `572020153`, `38595f69a`; PR #1431 |
| D | "Marcar como paga externamente" com comprovante | Não iniciado | `git grep -nw externalPayment` em `HEAD` sem resultado |
| E | Página de assinatura restrita a master ou delegado | Não iniciado | Nenhuma rota de `subscription-management` usa `hasDelegatedTeamManagementAccess` |
| F | Alertas de inadimplência | Parcial | Avisos da carência feitos na Fase C (D12). Faltam destinatário e degraus |
| G | Indicador de modo leitura e padronização visual | Parcial | `ReadOnlyAccessBanner` existe e está no shell. Falta o restante |

## Fase A: acesso em carência

**Objetivo.** Quem está em carência mantém acesso total; passada a carência, vira leitura em tudo que já tinha contratado.

- **A1.** `FeatureAccessService.resolveAllowedSlugs` (`app/api/services/featureAccess/FeatureAccessService.ts`) passou a tratar qualquer conta `past_due` como carência genérica (`isGenericBillingGrace`), reaproveitando `resolveBillingGraceUntil` (`app/api/shared/billing/billingGraceWindow.ts`). O caso Member PRO + CRM do PR #1395 foi mantido. O retorno inclui `mode: "full" | "read_only"`.
- **A2.** `resolveBackofficeAccessMode` em `BackofficePlatformUsersUseCase.ts` devolve `full`, `read_only` ou `none`; o repositório passou a selecionar `subscriptionNextDueDate`. O badge do backoffice mostra os três estados.
- **A3.** Botão "Cancelar" na aba Faturas, com `canCancelInvoice` (`features/utils/invoiceActions.ts`) e confirmação por `AlertDialog`. Reaproveita a rota existente de `deleteMasterUserInvoice`.

**Estado.** Implementado e mergeado. Marcadores presentes na `develop`: `resolveBackofficeAccessMode` em `BackofficePlatformUsersUseCase.ts`; `canCancelInvoice` em `invoiceActions.ts` e seu teste.

**Em aberto.** Regressão Member PRO + CRM do #1395 não confirmada (B1.G3). Contas sem `subscriptionNextDueDate` seguem sem carência e o volume em produção não foi medido (B1.G4). O PR #1381 foi mergeado com os lembretes por e-mail ainda em janelas fixas (1–5, 6–15 e 16+ de `lib/billing/delinquency-tier.ts`); ver Fase F.

## Fase B: add-ons e cobrança avulsa no AbacatePay

**Objetivo.** Toda cobrança nova de add-on vai ao AbacatePay pelo roteador, sem fallback para o Asaas.

Entregue, em ordem:

- 2026-11-17: cobrança de add-on por cartão com token `ctok_` (`942e23c8e`, D1), liquidação do add-on confirmado pelo provider com checagem de valor (`3bbf9a880`), recusa de troca de forma depois da confirmação (`25fb4b5c2`, D2).
- 2026-11-18: add-ons AbacatePay sem fallback Asaas (`495cb589b`, D3), correção do review do PR #1407 (`247e05ba2`, PR #1408).
- 2026-11-19: cobrança avulsa do backoffice por PIX e cartão (`cd40a2a87`), troca de forma bloqueada quando a cobrança AbacatePay não tem `paymentId` (`e13b54b69`).
- 2026-11-23: cobrança avulsa e confirmação agnósticas ao provedor (`3874db353`), registro único de provedor e roteador no card-checkout (`b49503ae6`), telefone do cliente obrigatório na cobrança (`57b19eb3a`).
- 2026-11-24: add-ons AbacatePay com confirmação agnóstica e parcelamento por ciclo (`8242b3cff`, D6), checkouts em fases com kit compartilhado (`f9676c7b1`, PR #1428).

**Estado.** Implementado e mergeado. O cobrador roteado (`lib/payment-provider/routed-charge.ts`) é usado por `IncrementalBillingService.ts` e por `BackofficePaymentUseCase.ts`. A migration das colunas `provider*` está em `supabase/migrations/20261117120000_corretor_studio_pending_action_provider.sql`.

**Em aberto.**

- Cobrança real no sandbox do AbacatePay: Não verificado (B3.G3).
- Troca de forma deixa a cobrança anterior aberta, porque o AbacatePay não cancela cobrança transparente (D2, B5).
- Reconciliação de tentativas `UNKNOWN` para `PENDING_ACTION_ADDON`: Não iniciado (B7).
- Campo `provider` em `BackofficePayment`: não reverificado (B8). `ProfileSubscription.provider` existe.
- Aplicação das migrations: só pela pipeline, depois do merge e com autorização do dono.

## Fase C: renovação reativa

**Objetivo.** Assinatura e renovação pelo roteador. A renovação é reativa (D8): o ciclo vence, há carência de 5 dias, depois somente leitura, e o master paga na página de pagamento. Não há cron de cobrança antecipada (o plano original previa um, que foi removido).

Entregue (detalhe em [06-fase-c-renovacao.md](06-fase-c-renovacao.md)): dois avisos por e-mail na carência (D12), `past_due` por data para contas do roteador (D14), corte do Asaas na confirmação do pagamento atrás do kill switch `PAYMENT_PROVIDER_RENEWAL_ENABLED` (D10, D11), prazo anterior normalizado na cotação e aviso de perda do ilimitado na tela (D13), botão de pagar do `/checkout` bloqueado até o aceite dos termos (D7).

**Estado.** Implementado e mergeado (PR #1432). Suíte oficial `bun run test` com 0 falhas na branch, typecheck, lint e governança com exit 0, E2E de checkout, add-on, adesão e renovação em Chromium (49 de 49) e Firefox (25 de 25), segundo o log de 2026-11-26.

**Em aberto.**

- Sandbox do AbacatePay (aprovação e recusa) e do Asaas (cancelamento remove cobranças pendentes): Não verificado (B9.G4).
- O corte do Asaas está desligado por padrão. Sem o kill switch ligado, a conta legada continua com a assinatura recorrente no Asaas e há risco de cobrança em duplicidade.
- D14 muda o acesso de contas do roteador vencidas há 1 a 5 dias (carência em vez de `restricted`). Confirmar antes do deploy.
- `CheckoutAsaasUseCase` (1270 linhas, 100% Asaas) não foi migrado.

## Regularização do master (entregue em 2026-11-25 e 2026-11-26)

Complementa as fases A e C: o que o master vê e faz quando a conta está em carência ou somente leitura.

- **Botão "Regularizar assinatura"** no painel "Acesso não liberado", só para o master com cobrança pendente (`039ba5d15`, D18). Componente `FeatureBlockedPanel`; regra em `canOfferPaymentFromBlockedFeature`.
- **Checkout em tela própria** `/pagamento/[supabaseId]`, fora do shell da conta (sem sidebar), com cabeçalho e "Sair", exigindo login e dono da conta (`1e6a8a88c`, D15). A rota antiga `/[supabaseId]/billing-grace-payment` responde 308 para a nova.
- **Add-on exige login** (`/addon-checkout/[pendingActionId]`) (D16).
- **Confirmação final** com contador de 5 segundos e "Ir agora", sem botão de cancelar, para `/[supabaseId]/dashboard` (D17).
- **Correções da pipeline** (`c948f5230`, `572020153`, `38595f69a`): link do e-mail de inadimplência, sessão de E2E resolvida no servidor por `getServerSessionUserId`, alvo de toque do "Sair" em 44 px.

**Pendências.** A API `/api/v1/addon-checkout/[id]` continua acessível pelo id da cobrança (endurecer por time é um passo à parte). A confirmação final do add-on não foi vista com pagamento confirmado. Painel e checkout foram vistos no navegador em desktop e celular; WebKit e leitor de tela: Não verificado.

## Fase D: marcar como paga externamente (pendente)

**Objetivo.** O operador do backoffice dá baixa em fatura paga fora do sistema, com comprovante. Nunca aparece para o cliente final.

**Próximos passos.**

1. Campo novo `payload.externalPayment { reference, proofUrl, operatorId, paidAt }` em `PendingAction` (ou equivalente para fatura Asaas), separado do waive.
2. Rota e UseCase novos em `BackofficePlatformUsersUseCase.ts`. Para fatura Asaas pendente, cancelar a cobrança remota antes da baixa local.
3. Interface: dialog que pede referência e comprovante, ligado ao item de menu hoje morto "Confirmar recebimento em dinheiro" em `app/backoffice/(app)/clients/[masterId]/invoices/[invoiceId]/features/container/BackofficeClientInvoiceDetailsContainer.tsx` (linha 354).
4. Briefing `impeccable shape` antes do JSX; revisão `impeccable` depois.

**Validação.** Fatura de `pending_action`; fatura Asaas (cancelamento remoto e baixa local); tentativa em fatura já paga deve ser rejeitada.

## Fase E: página de assinatura restrita (pendente)

**Objetivo.** Só master e delegados abrem a página de assinatura.

**Próximos passos.** Aplicar `hasDelegatedTeamManagementAccess` (`app/api/v1/utils/teamAccess.ts`, `isMaster || canManageAccountTeams`) nas rotas de `app/api/v1/subscription-management/` e em `app/[supabaseId]/subscription/features/container/SubscriptionContainer.tsx`, validando no cliente e na API, sem campo novo em `TeamMember`.

**Validação.** API nega acesso a quem não é master nem delegado; a interface oculta a página.

## Fase F: alertas de inadimplência (parcial)

**Objetivo.** O e-mail certo, uma única vez, no momento certo.

**Feito.** Os dois avisos da carência (início e último dia) saem uma vez por ciclo, com a data limite e o link da página de pagamento (D12). O link do e-mail aponta para `/pagamento/[supabaseId]`.

**Próximos passos.**

1. Confirmar que o destinatário é o responsável financeiro correto (hoje é `profile.email`) e fechar BILLING-GRACE-T002.
2. Decidir os degraus de janela fixa (6–15 e 16+) de `lib/billing/delinquency-tier.ts`, que divergem do cálculo dinâmico do acesso.

**Validação.** Cron executado duas vezes, um único e-mail (dedupe).

## Fase G: indicador de modo leitura e padronização visual (parcial)

**Objetivo.** O usuário em leitura entende a restrição antes de tentar escrever.

**Feito.** `ReadOnlyAccessBanner` (`app/[supabaseId]/components/ReadOnlyAccessBanner.tsx`) aparece no shell quando a decisão de acesso é `read_only`, com o botão de regularizar para o master. Ele lê `accountAccessDecision`, não o campo `mode` da A1.

**Próximos passos.**

1. Desabilitar botões de escrita com explicação (hoje o usuário só descobre o bloqueio ao receber o 403 do servidor).
2. Padronizar visualmente as novas ações de fatura (`design-system-guard`).

**Validação.** `design:check`, auditoria `impeccable` e inspeção renderizada em desktop e celular.

## Processo visual obrigatório

Toda fase com tela segue duas etapas, nesta ordem: briefing `impeccable shape` aprovado **antes** do JSX e revisão de implementação da skill `impeccable` **depois**. Nenhuma fase com interface é reportada como pronta sem as duas.

## Riscos abertos

- Corte do Asaas desligado por padrão: risco de cobrança em duplicidade para a conta legada.
- D14 muda o acesso de contas do roteador: confirmar antes do deploy.
- Sandbox do AbacatePay e do Asaas sem validação.
- API do add-on acessível pelo id da cobrança (D16).
- Contas sem `subscriptionNextDueDate` seguem sem carência.
- Lembretes por e-mail em janelas fixas divergem do controle de acesso.
- A Decisão 13 da spec antiga no Obsidian está desatualizada (D4). Esta pasta é a fonte viva.
- O E2E de landing pages (`templates-flow.spec.ts`, `main#top` duplicado) falhou na pipeline do PR #1431 e a `develop` tem falhas recentes de E2E. Não é desta feature.

## O que não fazer

- Expor ações de fatura no produto do cliente final.
- Criar fallback automático para o Asaas em cobrança nova, nem para contas legadas.
- Reaproveitar o mecanismo de waive para "pago externamente".
- Aplicar migration em banco compartilhado fora da pipeline, ou ligar o kill switch da renovação sem autorização do dono.
