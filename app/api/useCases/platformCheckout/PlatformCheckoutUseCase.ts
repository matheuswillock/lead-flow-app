import { randomUUID } from "node:crypto"
import { Output } from "@/lib/output"
import type { PlatformPurchase, PlatformPurchaseType } from "@prisma/client"
import type { IPlatformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/IPlatformPurchaseRepository"
import { platformPurchaseRepository } from "@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository"
import {
  buildPlatformPurchaseExternalReference,
  parsePlatformPurchaseExternalReference,
} from "@/lib/billing/platform-purchase-external-reference"
import { getFullUrl } from "@/lib/utils/app-url"
import type { AsaasAccountId } from "@/lib/asaas"

export type CreatePlatformCheckoutInput = {
  productSlug: string
  purchaseType: PlatformPurchaseType
  profileId: string
  teamId?: string | null
  billingType: "PIX" | "CREDIT_CARD"
  amount: number
  quantity?: number | null
  description?: string | null
  metadata?: Record<string, unknown>
  asaasCustomerId?: string | null
}

export type PlatformCheckoutDetails = {
  checkoutId: string
  purchaseId: string
  productSlug: string
  purchaseType: PlatformPurchaseType
  status: PlatformPurchase["status"]
  billingType: string | null
  amount: number
  quantity: number | null
  description: string | null
  externalReference: string
  asaasPaymentId: string | null
  checkoutUrl: string
  teamId: string | null
  profileId: string
  metadata: unknown
}

const VALID_PURCHASE_TYPES: PlatformPurchaseType[] = [
  "email_credits",
  "feature_addon",
  "radar_self_service",
  "radar_managed",
  "subscription_capacity",
]

function buildPublicCheckoutUrl(purchaseId: string): string {
  const path = `/addon-checkout/${purchaseId}`
  try {
    return getFullUrl(path)
  } catch {
    return path
  }
}

function toDetails(purchase: PlatformPurchase): PlatformCheckoutDetails {
  return {
    checkoutId: purchase.id,
    purchaseId: purchase.id,
    productSlug: purchase.productSlug,
    purchaseType: purchase.purchaseType,
    status: purchase.status,
    billingType: purchase.billingType,
    amount: Number(purchase.amount),
    quantity: purchase.quantity,
    description: purchase.description,
    externalReference: purchase.externalReference,
    asaasPaymentId: purchase.asaasPaymentId,
    checkoutUrl: buildPublicCheckoutUrl(purchase.id),
    teamId: purchase.teamId,
    profileId: purchase.profileId,
    metadata: purchase.metadata,
  }
}

export class PlatformCheckoutUseCase {
  constructor(private readonly purchaseRepo: IPlatformPurchaseRepository) {}

  async createCheckout(input: CreatePlatformCheckoutInput): Promise<Output> {
    try {
      if (!input.profileId?.trim()) {
        return new Output(false, [], ["profileId é obrigatório"], null)
      }
      if (!input.productSlug?.trim()) {
        return new Output(false, [], ["productSlug é obrigatório"], null)
      }
      if (!VALID_PURCHASE_TYPES.includes(input.purchaseType)) {
        return new Output(false, [], ["purchaseType inválido"], null)
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        return new Output(false, [], ["amount deve ser maior que zero"], null)
      }
      if (input.billingType !== "PIX" && input.billingType !== "CREDIT_CARD") {
        return new Output(false, [], ["billingType inválido"], null)
      }

      const purchaseId = randomUUID()
      const externalReference = buildPlatformPurchaseExternalReference(purchaseId)

      const created = await this.purchaseRepo.create({
        id: purchaseId,
        profileId: input.profileId,
        teamId: input.teamId ?? null,
        productSlug: input.productSlug.trim(),
        purchaseType: input.purchaseType,
        status: "pending",
        billingType: input.billingType,
        amount: input.amount,
        quantity: input.quantity ?? null,
        description: input.description ?? null,
        metadata: (input.metadata ?? undefined) as never,
        asaasCustomerId: input.asaasCustomerId ?? null,
        externalReference,
      })

      return new Output(true, ["Checkout criado com sucesso"], [], toDetails(created))
    } catch (error) {
      console.error("[PlatformCheckoutUseCase][createCheckout]", error)
      return new Output(false, [], ["Erro ao criar checkout genérico"], null)
    }
  }

  async getCheckoutDetails(checkoutId: string): Promise<Output> {
    try {
      if (!checkoutId?.trim()) {
        return new Output(false, [], ["checkoutId é obrigatório"], null)
      }

      const purchase = await this.purchaseRepo.findById(checkoutId)
      if (!purchase) {
        return new Output(false, [], ["Checkout não encontrado"], null)
      }

      return new Output(true, [], [], toDetails(purchase))
    } catch (error) {
      console.error("[PlatformCheckoutUseCase][getCheckoutDetails]", error)
      return new Output(false, [], ["Erro ao carregar checkout"], null)
    }
  }

  // account: E4 (C33 "5º ponto") — o mesmo asaasPaymentId pode existir nas
  // duas contas Asaas; sem o filtro, uma colisão aplicaria a compra errada.
  async applyPaidPurchase(input: {
    externalReference?: string | null
    asaasPaymentId: string
    account: AsaasAccountId
  }): Promise<Output> {
    try {
      if (!input.asaasPaymentId?.trim()) {
        return new Output(false, [], ["asaasPaymentId é obrigatório"], null)
      }

      const byPayment = await this.purchaseRepo.findByAsaasPaymentId(
        input.asaasPaymentId,
        input.account
      )
      if (byPayment?.status === "paid") {
        return new Output(true, ["Compra já aplicada"], [], toDetails(byPayment))
      }

      const purchaseId =
        byPayment?.id ?? parsePlatformPurchaseExternalReference(input.externalReference)
      if (!purchaseId) {
        return new Output(false, [], ["Compra não encontrada para externalReference"], null)
      }

      const existing = byPayment ?? (await this.purchaseRepo.findById(purchaseId))
      if (!existing) {
        return new Output(false, [], ["Compra não encontrada"], null)
      }

      if (existing.status === "paid") {
        return new Output(true, ["Compra já aplicada"], [], toDetails(existing))
      }

      const marked = await this.purchaseRepo.markPaidOnce({
        id: existing.id,
        asaasPaymentId: input.asaasPaymentId,
        account: input.account,
      })

      if (!marked) {
        const current = await this.purchaseRepo.findById(existing.id)
        if (current?.status === "paid") {
          return new Output(true, ["Compra já aplicada"], [], toDetails(current))
        }
        return new Output(false, [], ["Não foi possível marcar a compra como paga"], null)
      }

      // Entitlement específico (ex.: créditos de e-mail) fica no Ticket 4.
      return new Output(true, ["Compra aplicada com sucesso"], [], toDetails(marked))
    } catch (error) {
      console.error("[PlatformCheckoutUseCase][applyPaidPurchase]", error)
      return new Output(false, [], ["Erro ao aplicar compra paga"], null)
    }
  }
}

export const platformCheckoutUseCase = new PlatformCheckoutUseCase(platformPurchaseRepository)
