import type { BillingGracePayment, Prisma } from "@prisma/client"
import type { RenewalAccount } from "@/app/api/shared/billing/renewalQuote"

export type CreateBillingGracePaymentInput = {
  accountId: string
  teamId: string | null
  subscriptionId: string | null
  cycle: string
  amountCents: number
  effectivePriceCents: number
  provider: string
  providerEnvironment: string
  idempotencyKey: string
  quoteExpiresAt: Date
  /** Usuários que o master não manteve; saem dos times ao confirmar o pagamento. */
  revokedProfileIds: string[]
}

export interface IBillingGracePaymentRepository {
  findAccountContext(supabaseId: string): Promise<{
    accountId: string
    teamId: string | null
    subscriptionId: string | null
    name: string
    email: string
    taxId: string
    cellphone: string
    hasUnlimitedUsers: boolean
    hasPermanentSubscription: boolean
  } & RenewalAccount | null>
  create(input: CreateBillingGracePaymentInput): Promise<BillingGracePayment>
  findByIdForAccount(id: string, accountId: string): Promise<BillingGracePayment | null>
  findById(id: string): Promise<BillingGracePayment | null>
  /** A chave de idempotência é do cliente: só vale dentro da conta que a enviou. */
  findByIdempotencyKey(input: { accountId: string; idempotencyKey: string }): Promise<BillingGracePayment | null>
  attachProviderAttempt(input: {
    id: string
    providerSessionId: string
    providerAttemptId: string
    providerExternalId?: string | null
    paymentInstructions?: Prisma.InputJsonValue
  }): Promise<BillingGracePayment>
  markConfirmed(input: {
    id: string
    providerExternalId: string
    confirmedAt: Date
  }): Promise<BillingGracePayment | null>
  markFailed(id: string, reason: string): Promise<BillingGracePayment | null>
  completeAndRestoreAccess(id: string, now?: Date): Promise<BillingGracePayment | null>
}
