export type AsaasPaymentEventSnapshot = {
  readonly valueInReais: number | null
  readonly status: string | null
  readonly event: string | null
}

export interface IAsaasPaymentEventSourceRepository {
  findLatestPaymentEvent(input: {
    account: "primary" | "legacy"
    paymentId: string
  }): Promise<AsaasPaymentEventSnapshot | null>
  listPaymentIdsReceivedSince(input: {
    since: Date
    limit: number
  }): Promise<ReadonlyArray<{ account: "primary" | "legacy"; paymentId: string }>>
}
