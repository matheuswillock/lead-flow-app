# SPEC de backend: assinaturas e add-ons

**Estado em 2026-11-26:** fases A, B e C entregues e mergeadas na `develop` (PRs #1381, #1408, #1413, #1414, #1431 e #1432). Fases D, E e F pendentes; G parcial. Plano completo em [07-plano-das-fases.md](07-plano-das-fases.md).
**Telas relacionadas:** [spec-frontend.md](spec-frontend.md)
**Notas de implementação e gates:** [03-backend.md](03-backend.md)
**Decisões:** [05-decisoes.md](05-decisoes.md) · **Progresso:** [04-progresso.md](04-progresso.md)

Este documento especifica as regras, contratos, dados e testes que o backend precisa cumprir. Não descreve passos de implementação. Para isso, ver `03-backend.md`.

Arquitetura: `Route → UseCase → Service → Repository/Prisma`. Route só trata HTTP. UseCase depende de interfaces e não chama Prisma diretamente.

## 1. Cobertura funcional

| Capacidade | Estado atual | Backend necessário |
| --- | --- | --- |
| Acesso em carência por contrato | Implementado e mergeado (PR #1381): `FeatureAccessService`, `isGenericBillingGrace`, com `mode` | Verificar regressão Member PRO + CRM e dados de produção sem `subscriptionNextDueDate` |
| Resolver tri-estado do backoffice | Implementado e mergeado (`resolveBackofficeAccessMode`) | Teste de regressão dedicado para os três estados |
| Cobrança de add-on por PIX | Implementado e mergeado (Fase B). Chama AbacatePay pelo cobrador roteado e não toca o Asaas | Sandbox real da AbacatePay |
| Cobrança de add-on por cartão | Backend aceita só `cardToken` (`ctok_`) e cobra pelo AbacatePay (`942e23c8e`) | Tokenização real contra o AbacatePay: Não verificado |
| Consulta de status de add-on | Implementado e mergeado. Ramifica por provider | Reconciliação de `UNKNOWN` (B7) |
| Troca de forma de pagamento | Recusada depois da confirmação (D2). A cobrança anterior não é cancelada, porque o AbacatePay não cancela cobrança transparente | Tratar a tentativa substituída pendente |
| Liquidação de ação pendente pelo provider | `PaymentOwnerSettlementService` aplica `PENDING_ACTION_ADDON` quando o valor confere e recusa valor divergente ou ausente | Fluxo completo do webhook do AbacatePay de ponta a ponta: Não verificado |
| Rotas de checkout com sessão obrigatória | Implementado e mergeado (D15, D16): `/pagamento/` e `/addon-checkout/` em `requiresSessionPage`; redirect 308 da rota antiga; `getServerSessionUserId` | Proteger a API do add-on por time |
| Reconciliação de `UNKNOWN` para add-on | Não implementado | Tratar owner `PENDING_ACTION_ADDON` |
| Campo `provider` em faturas do backoffice | Não encontrado no schema | Decidir e migrar, ou registrar que não é necessário |
| Renovação pelo roteador | Implementado e mergeado (PR #1432) como fluxo reativo (D8): página de pagamento com o roteador, `past_due` por data para contas do roteador (D14) e corte do Asaas na confirmação do pagamento (D10). `CheckoutAsaasUseCase` (1270 linhas, todas Asaas) não foi alterado | Sandbox do AbacatePay e do Asaas |
| Marcar fatura como paga externamente | Não iniciado | Rota e UseCase próprios, separados do waive |
| Cancelar fatura no backoffice | Backend existente (`deleteMasterUserInvoice`) | Nenhum. Só o botão no front |
| Restrição de página de assinatura na API | Não verificado | Negar a quem não é master nem delegado |
| Alertas de inadimplência | `OverdueReminderUseCase` existe, usa `delinquency-tier` com janelas fixas nos degraus 6 a 15 e 16+. Os dois avisos da carência (início e último dia) foram acrescentados na Fase C (D12) | Confirmar destinatário e dedupe dos degraus |
| Colunas `provider*` em `corretor_studio_pending_actions` | Migration criada em `supabase/migrations/20261117120000_corretor_studio_pending_action_provider.sql`, não aplicada | Aplicação pela pipeline, após merge na develop |

## 2. Regras de negócio

- **R1, carência.** Conta `past_due` dentro do prazo de carência tem acesso total, com aviso. Depois do prazo, tem `read_only` em tudo que já contratou. Não há lista fixa de módulos. Conta `suspended` ou `canceled` não tem acesso.
- **R2, sem fallback.** Cobrança nova de add-on vai só para o AbacatePay, inclusive em conta legada. Não há fallback automático para o Asaas.
- **R3, cartão.** O servidor só aceita token `ctok_` emitido no navegador. Número e CVV nunca chegam ao servidor. O `cardToken` permanente devolvido pelo AbacatePay pode ser salvo para cobrança futura.
  - Risco residual: o limite de 60 segundos e o uso único são garantidos pelo AbacatePay. A verificação local usa o horário do servidor no recebimento e não é uma barreira independente. O mesmo vale para a carência, que já funciona assim. Não há como o servidor saber quando o token foi gerado no navegador.
- **R4, troca de forma de pagamento.** Ao trocar PIX por cartão, ou cartão por PIX, a cobrança aberta anterior é cancelada no AbacatePay antes da nova ser criada.
- **R5, ações de fatura.** Cancelar e marcar como paga externamente existem só no backoffice. Nunca aparecem para o cliente final.
- **R6, página de assinatura.** Permitida só para `isMaster || canManageAccountTeams`. Vale na API e no cliente.
- **R7, baixa externa.** "Marcar como paga externamente" usa campo próprio, com referência, comprovante, operador e data. Não reaproveita o mecanismo de waive.
- **R8, checkouts logados.** O checkout de regularização (`/pagamento/[supabaseId]`) e o de add-on (`/addon-checkout/[pendingActionId]`) exigem sessão: o proxy os trata como páginas de sessão obrigatória e redireciona para `/sign-in?next=<caminho>`. Na regularização, só o dono da conta (o `supabaseId` da URL igual ao usuário logado) vê o checkout. A rota antiga `/[supabaseId]/billing-grace-payment` responde 308 para a nova. O usuário do servidor vem de `getServerSessionUserId`, que também aceita o cookie assinado do E2E.

## 3. Contratos

| Endpoint | Estado | Contrato alvo |
| --- | --- | --- |
| `POST /api/v1/addon-checkout/[pendingActionId]/pay` | Backend atualizado: aceita `cardToken` (`ctok_`). `creditCard` removido | Aceita `cardToken` (`ctok_`) e `customer`. Cartão sem token é recusado (R3) |
| `GET /api/v1/addon-checkout/[pendingActionId]/status` | Existe. Ramifica por provider (B2) | Mesmo contrato. Ação confirmada pelo provider aplica sem Asaas |
| `POST /api/v1/addon-checkout/[pendingActionId]/billing-type` | Existe. Não cancela cobrança AbacatePay | Cancela a cobrança anterior antes de criar a nova (R4) |
| `DELETE /api/v1/backoffice/platform-users/[id]/invoices/[invoiceId]` | Existe | Sem alteração |
| `GET /pagamento/[supabaseId]` (página) | Existe (D15). Exige sessão e dono da conta | Sem alteração |
| `GET /[supabaseId]/billing-grace-payment` (página antiga) | 308 para `/pagamento/[supabaseId]` | Sem alteração |
| `GET /addon-checkout/[pendingActionId]` (página) | Existe. Exige sessão (D16) | Sem alteração |
| `GET /api/v1/addon-checkout/[pendingActionId]` | Existe. Acessível pelo id da cobrança | Exigir que o usuário pertença ao time da cobrança (pendência de D16) |
| Rota de baixa externa | Não existe | A definir na Fase D. Campos: referência, comprovante, operador, data (R7) |

## 4. Dados

- `corretor_studio_pending_actions`: colunas `provider`, `provider_environment`, `provider_session_id`, `provider_attempt_id` e `provider_external_id`, com índice em `provider_external_id`. A migration existe e não foi aplicada.
- `PaymentProviderSession` e `PaymentProviderAttempt`: sessão e tentativa usadas com `ownerType = PENDING_ACTION_ADDON`.
- Campo `externalPayment` com referência, comprovante, operador e data: a definir na Fase D.

## 5. Testes exigidos

| Teste | Arquivo | Estado |
| --- | --- | --- |
| PIX de add-on vai ao AbacatePay e não toca o Asaas | `IncrementalBillingService.account-routing.test.ts` (T-40.4) | passa isolado |
| Cartão de add-on recusado antes de qualquer escrita | mesmo arquivo (T-40.5) | passa isolado |
| Status AbacatePay: confirmado aplica, pendente não aplica, sem tentativa retorna erro | `AddOnCheckoutUseCase.checkPaymentStatus.test.ts` | passa isolado |
| Resolver tri-estado do backoffice | não identificado | pendente |
| Carência genérica, `read_only` e `suspended` | `FeatureAccessService.readOnlyWindow.test.ts` (no PR) | não executado nesta análise |
| Router nunca cai para Asaas em cobrança nova | não criado | pendente |
| Troca de forma cancela cobrança anterior | não criado | pendente |
| Webhook AbacatePay confirma ação | não criado | pendente |
| Baixa externa rejeita fatura já paga | não criado | pendente |

Suíte completa: 3 falhas e 3 erros, ver [04-progresso.md](04-progresso.md). O erro de `withPrismaRetry` existe também na develop.

## 6. Pendências

1. Tokenização real do cartão de add-on contra o AbacatePay (R3, D1): o backend e o checkout já usam `ctok_`; falta a prova contra o provedor.
2. Tratar a tentativa de pagamento substituída pendente (R4, D2): o AbacatePay não cancela cobrança transparente.
3. Reconciliação de `UNKNOWN` para add-on e campo `provider` em `BackofficePayment`.
4. Fases D, E e F; G no que falta.
5. Sandbox real da AbacatePay e do Asaas (PIX e cartão de add-on, renovação e corte).
6. Proteger a API do add-on por time (D16).
