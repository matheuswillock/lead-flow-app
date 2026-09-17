import type { SubscriptionStatus } from "@prisma/client"

/**
 * Um registro por master (Profile isMaster/role=manager) — verdade local
 * para o painel de assinaturas (E4, §7.8). `cycle`/`chargedAmount` seguem a
 * mesma cadeia real de [[50 — Backoffice de Cobrança — Backend]] E5
 * (assinatura → adesão → produto), nunca preço hardcoded.
 */
export interface PanelSubscriptionRecord {
  profileId: string
  hasPermanentSubscription: boolean
  subscriptionStatus: SubscriptionStatus | null
  cycle: string | null
  chargedAmount: number | null
  nextDueDate: Date | null
  subscriptionEndDate: Date | null
  productName: string | null
  asaasSubscriptionId: string | null
  asaasSubscriptionAccount: "primary" | "legacy"
}

export interface IBackofficeSubscriptionsPanelRepository {
  findActiveMastersForPanel(): Promise<PanelSubscriptionRecord[]>
  countMemberProExternalAdhesions(): Promise<number>
}
