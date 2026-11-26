# SPEC de backend: assinaturas e add-ons

**Estado:** em implementação. Fase A no PR #1381. Fase B1 e B2 locais. Demais fases não iniciadas.
**Telas relacionadas:** [spec-frontend.md](spec-frontend.md)
**Notas de implementação e gates:** [03-backend.md](03-backend.md)
**Decisões:** [05-decisoes.md](05-decisoes.md) · **Progresso:** [04-progresso.md](04-progresso.md)

Este documento especifica as regras, contratos, dados e testes que o backend precisa cumprir. Não descreve passos de implementação. Para isso, ver `03-backend.md`.

Arquitetura: `Route → UseCase → Service → Repository/Prisma`. Route só trata HTTP. UseCase depende de interfaces e não chama Prisma diretamente.

## 1. Cobertura funcional

| Capacidade | Estado atual | Backend necessário |
| --- | --- | --- |
| Acesso em carência por contrato | Implementado no PR (`FeatureAccessService`, `isGenericBillingGrace`), com `mode` | Verificar regressão Member PRO + CRM e dados de produção sem `subscriptionNextDueDate` |
| Resolver tri-estado do backoffice | Implementado no PR (`resolveBackofficeAccessMode`) | Teste de regressão dedicado para os três estados |
| Cobrança de add-on por PIX | Implementado localmente (B1). Chama AbacatePay e não toca o Asaas | Sandbox real da AbacatePay |
| Cobrança de add-on por cartão | Bloqueada. Recusa `CREDIT_CARD` | Tokenização no navegador, conforme R3 |
| Consulta de status de add-on | Implementado localmente (B2). Ramifica por provider | Webhook da AbacatePay (B6) |
| Troca de forma de pagamento | Sem cancelamento da cobrança anterior | Cancelar cobrança anterior, conforme R4 |
| Webhook AbacatePay para ação pendente | Não implementado | Confirmar ação pendente sem polling |
| Reconciliação de `UNKNOWN` para add-on | Não implementado | Tratar owner `PENDING_ACTION_ADDON` |
| Campo `provider` em faturas do backoffice | Não encontrado no schema | Decidir e migrar, ou registrar que não é necessário |
| Renovação pelo roteador | Implementado na branch da Fase C como fluxo reativo (D8): página de pagamento com o roteador, `past_due` por data para contas do roteador (D14) e corte do Asaas na confirmação do pagamento (D10). `CheckoutAsaasUseCase` (1270 linhas, todas Asaas) não foi alterado | Sandbox do AbacatePay e do Asaas; cartão no `/checkout` |
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

## 3. Contratos

| Endpoint | Estado | Contrato alvo |
| --- | --- | --- |
| `POST /api/v1/addon-checkout/[pendingActionId]/pay` | Backend atualizado: aceita `cardToken` (`ctok_`). `creditCard` removido | Aceita `cardToken` (`ctok_`) e `customer`. Cartão sem token é recusado (R3) |
| `GET /api/v1/addon-checkout/[pendingActionId]/status` | Existe. Ramifica por provider (B2) | Mesmo contrato. Ação confirmada pelo provider aplica sem Asaas |
| `POST /api/v1/addon-checkout/[pendingActionId]/billing-type` | Existe. Não cancela cobrança AbacatePay | Cancela a cobrança anterior antes de criar a nova (R4) |
| `DELETE /api/v1/backoffice/platform-users/[id]/invoices/[invoiceId]` | Existe | Sem alteração |
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

1. Implementar R3 (D1) e remover `creditCard` do contrato de pagamento.
2. Implementar R4 (D2).
3. Webhook, reconciliação e campo `provider` nos modelos do backoffice.
4. Fases C, D, E e F.
5. Sandbox real da AbacatePay para PIX de add-on.
