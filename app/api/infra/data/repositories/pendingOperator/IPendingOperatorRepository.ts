import type { PendingOperator, Profile, UserFunction } from "@prisma/client"
import type { AsaasAccountId } from "@/lib/asaas"

export type PendingOperatorWithManager = PendingOperator & {
  manager: Pick<
    Profile,
    | "id"
    | "email"
    | "fullName"
    | "supabaseId"
    | "asaasSubscriptionId"
    | "asaasSubscriptionAccount"
    | "asaasCustomerId"
    | "asaasCustomerAccount"
    | "timezone"
  >
}

export interface CreatePendingOperatorInput {
  managerId: string
  teamId?: string | null
  name: string
  email: string
  role: string
  functions: UserFunction[]
  paymentId: string
  subscriptionId?: string | null
  paymentStatus: string
  paymentMethod: string
}

export interface IPendingOperatorRepository {
  create(data: CreatePendingOperatorInput): Promise<PendingOperator>
  // Achado Codex (PR #1137, P1, round 8): duas checkouts pendentes para o
  // mesmo e-mail sob o mesmo manager (race entre criação e confirmação de
  // pagamento) faziam o resume-por-e-mail de processOperatorCheckoutPaid
  // tratar a segunda cobrança como retomada da primeira — incrementando a
  // assinatura de novo sem provisionar um segundo operador de verdade.
  // Usado por createOperatorCheckout para bloquear a criação de um segundo
  // checkout enquanto o primeiro ainda está em voo.
  findActiveByManagerAndEmail(
    managerId: string,
    email: string
  ): Promise<{ id: string; createdAt: Date } | null>
  // account: filtra pela conta PERSISTIDA no instante em que o
  // checkoutSessionId nasceu (achado Codex, PR #1137, P1, round 7) — um
  // checkoutSessionId histórico da legacy pode colidir com um novo da
  // primary (C33), aplicando o operador errado para o manager errado.
  findByPaymentIdWithManager(
    paymentId: string,
    account: AsaasAccountId
  ): Promise<PendingOperatorWithManager | null>
  updatePaymentId(id: string, paymentId: string, account: AsaasAccountId): Promise<void>
  // Achado Codex/cursor[bot] (PR #1137, P1, round 11): marca o operador
  // como criado ANTES de incrementar operatorCount/deletar a linha — sem
  // isso, um retry após incrementOperatorCount falhar não tinha como saber
  // que o operador já existia (deleteById já tinha rodado numa tentativa
  // anterior, mas o incremento não).
  markOperatorCreated(id: string, operatorId: string): Promise<void>
  // Marca que o incremento de +R$19,90 na assinatura antiga do manager já
  // foi aplicado (achado Codex no PR #1137, P1) — processOperatorCheckoutPaid
  // consulta este marcador antes de reaplicar o incremento numa retentativa
  // do webhook, evitando cobrar o mesmo operador duas vezes.
  markSubscriptionUpdated(id: string): Promise<void>
  deleteById(id: string): Promise<void>
}
