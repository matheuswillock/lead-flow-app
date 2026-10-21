import type { BackofficeAdhesionPayment, Prisma } from "@prisma/client"

export type CreateBackofficeAdhesionPaymentInput = {
  adhesionId: string
  amountCents: number
  provider: string
  providerEnvironment: string
  idempotencyKey: string
}

export interface IBackofficeAdhesionPaymentRepository {
  create(input: CreateBackofficeAdhesionPaymentInput): Promise<BackofficeAdhesionPayment>
  findById(id: string): Promise<BackofficeAdhesionPayment | null>
  /** A chave de idempotência é do cliente: só vale dentro da adesão que a enviou. */
  findByIdempotencyKey(input: {
    adhesionId: string
    idempotencyKey: string
  }): Promise<BackofficeAdhesionPayment | null>
  findLatestByAdhesion(adhesionId: string): Promise<BackofficeAdhesionPayment | null>
  attachProviderAttempt(input: {
    id: string
    providerSessionId: string
    providerAttemptId: string
    providerExternalId?: string | null
    paymentInstructions?: Prisma.InputJsonValue
  }): Promise<BackofficeAdhesionPayment>
  /** Idempotente: devolve a linha já concluída sem regredir o status. */
  markConfirmed(input: {
    id: string
    providerExternalId: string
    confirmedAt: Date
  }): Promise<BackofficeAdhesionPayment | null>
  markCompleted(id: string, now?: Date): Promise<BackofficeAdhesionPayment | null>
  markFailed(id: string, reason: string): Promise<BackofficeAdhesionPayment | null>
}
