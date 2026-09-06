import type {
  PlatformPurchase,
  PlatformPurchaseStatus,
  PlatformPurchaseType,
  Prisma,
} from "@prisma/client"
import type { AsaasAccountId } from "@/lib/asaas"

export type CreatePlatformPurchaseInput = {
  id: string
  profileId: string
  teamId?: string | null
  productSlug: string
  purchaseType: PlatformPurchaseType
  status?: PlatformPurchaseStatus
  billingType?: string | null
  amount: number | string
  quantity?: number | null
  description?: string | null
  metadata?: Prisma.InputJsonValue
  asaasPaymentId?: string | null
  asaasCustomerId?: string | null
  externalReference: string
}

export type UpdatePlatformPurchaseInput = {
  status?: PlatformPurchaseStatus
  billingType?: string | null
  asaasPaymentId?: string | null
  asaasCustomerId?: string | null
  paidAt?: Date | null
  appliedAt?: Date | null
  metadata?: Prisma.InputJsonValue
}

export interface IPlatformPurchaseRepository {
  create(data: CreatePlatformPurchaseInput): Promise<PlatformPurchase>
  findById(id: string): Promise<PlatformPurchase | null>
  findByExternalReference(externalReference: string): Promise<PlatformPurchase | null>
  // account: E4 (C33 "5º ponto") — o mesmo asaasPaymentId pode existir nas
  // duas contas Asaas; o lookup MUST filtrar por conta para não aplicar a
  // compra errada numa colisão.
  findByAsaasPaymentId(asaasPaymentId: string, account: AsaasAccountId): Promise<PlatformPurchase | null>
  update(id: string, data: UpdatePlatformPurchaseInput): Promise<PlatformPurchase>
  markPaidOnce(input: {
    id: string
    asaasPaymentId: string
    account: AsaasAccountId
    paidAt?: Date
  }): Promise<PlatformPurchase | null>
}
