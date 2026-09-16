/**
 * Leitura read-only do lado do banco usada pela reconciliação de 30-E1.
 * Interface + implementação (DIP) para que `reconcileInventory` (função
 * pura) nunca dependa de Prisma diretamente — só de fixtures no teste.
 *
 * Índice do lado do banco (nomes de model Prisma; `@@map` resolve o nome
 * físico automaticamente pelo client, nenhuma SQL raw aqui):
 * `Profile.asaasCustomerId`, `BackofficeAdhesion.asaasCustomerId`,
 * `ProfileSubscription.asaasSubscriptionId`.
 */

export type DbCustomerPointer = {
  /** id da linha de origem (profile.id ou backofficeAdhesion.id) */
  refId: string
  source: "profile" | "adhesion"
  asaasCustomerId: string
  email: string | null
}

export type DbSubscriptionPointer = {
  /** id da linha corretor_studio_profile_subscriptions */
  refId: string
  profileId: string
  asaasSubscriptionId: string
  /** SubscriptionStatus local (enum minúsculo) — pode ser null */
  subscriptionStatus: string | null
  subscriptionEndDate: Date | null
}

export interface IBillingInventoryRepository {
  listCustomerPointers(): Promise<DbCustomerPointer[]>
  listSubscriptionPointers(): Promise<DbSubscriptionPointer[]>
}
