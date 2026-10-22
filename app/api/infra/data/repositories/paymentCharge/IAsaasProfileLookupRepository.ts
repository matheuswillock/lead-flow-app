export interface IAsaasProfileLookupRepository {
  /** Perfil dono da cobrança Asaas, resolvido pela assinatura e depois pelo cliente, sempre por conta. */
  findProfileId(input: {
    readonly account: "primary" | "legacy"
    readonly subscriptionId?: string | null
    readonly customerId?: string | null
  }): Promise<{ readonly profileId: string; readonly subscriptionId: string | null } | null>
}
