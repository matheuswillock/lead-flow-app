/**
 * Leitura read-only do lado do banco usada pela reconciliação de 30-E1.
 * Interface + implementação (DIP) para que `reconcileInventory` (função
 * pura) nunca dependa de Prisma diretamente — só de fixtures no teste.
 *
 * Índice do lado do banco (nomes de model Prisma; `@@map` resolve o nome
 * físico automaticamente pelo client, nenhuma SQL raw aqui):
 * `Profile.asaasCustomerId`, `BackofficeAdhesion.asaasCustomerId`,
 * `BackofficeClient.asaasCustomerId`,
 * `ProfileSubscription.asaasSubscriptionId` (+ fallback legado
 * `Profile.asaasSubscriptionId`, mesmo padrão de
 * `AsaasSubscriptionSyncRepository.getSyncSnapshot`).
 *
 * Escopo por conta: o inventário compara UMA conta Asaas por execução, e
 * durante a janela dual `cus_`/`sub_` podem colidir entre contas (C33) —
 * por isso os métodos recebem a conta e filtram
 * `Profile.asaasCustomerAccount` / `BackofficeAdhesion.asaasAccount` /
 * `BackofficeClient.asaasAccount` / `Profile.asaasSubscriptionAccount`.
 * A exceção do `BackofficeClient` (ponteiro sem filtro enquanto a coluna
 * não existia) caiu com 30-E3, que entregou `BackofficeClient.asaasAccount`.
 * `ProfileSubscription.asaasSubscriptionAccount` **também entrou no filtro**
 * depois que `20260918150645_backfill-legacy-account-new-pointer-columns.sql`
 * parou de deixar a coluna constante — ver o comentário em
 * `BillingInventoryRepository.listSubscriptionPointers`.
 *
 * Ressalva viva (não é débito de estilo): nenhum writer de
 * `profileSubscription` grava `asaasSubscriptionAccount` hoje — a coluna vem
 * do default e do backfill. `ProfileSubscription.profileId` é `@unique`, então
 * a linha é reescrita no lugar quando o cliente migra de conta; enquanto o
 * writer não existir, o ponteiro migrado continua rotulado `legacy` e vira
 * ORFAO/FANTASMA falso na reconciliação diária de E7. O padrão a seguir é o de
 * `ProfileRepository.updateAsaasCustomerId` / `BillingRepository.
 * updateAsaasCustomerId`, que gravam a conta junto do id.
 */

import type { AsaasAccountId } from "@/lib/asaas/asaas-account"

export type DbCustomerPointer = {
  /** id da linha de origem (profile.id, backofficeAdhesion.id ou backofficeClient.id) */
  refId: string
  source: "profile" | "adhesion" | "backofficeClient"
  asaasCustomerId: string
  email: string | null
}

export type DbSubscriptionPointer = {
  /** id da linha de origem (profileSubscription.id ou, no fallback, profile.id) */
  refId: string
  profileId: string
  source: "profileSubscription" | "profileFallback"
  asaasSubscriptionId: string
  /** SubscriptionStatus local (enum minúsculo) — pode ser null */
  subscriptionStatus: string | null
  subscriptionEndDate: Date | null
}

export interface IBillingInventoryRepository {
  listCustomerPointers(account: AsaasAccountId): Promise<DbCustomerPointer[]>
  listSubscriptionPointers(account: AsaasAccountId): Promise<DbSubscriptionPointer[]>
}
