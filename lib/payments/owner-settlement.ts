export type OwnerSettlementInput = {
  readonly ownerType: string
  readonly ownerId: string
  readonly externalId: string
  /** Valor confirmado pelo provider (webhook/consulta), em centavos; null = não informado. */
  readonly amountInCents: number | null
  readonly paidAt: Date
}

export type OwnerSettlementResult = "settled" | "unsupported"

/** Aplica o efeito de domínio de um pagamento confirmado pelo provider. Idempotente. */
export interface PaymentOwnerSettlement {
  settleConfirmed(input: OwnerSettlementInput): Promise<OwnerSettlementResult>
}
