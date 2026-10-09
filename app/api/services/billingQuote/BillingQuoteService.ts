import type {
  BillingQuote,
  BillingQuoteAdjustment,
  BillingQuoteCatalogItem,
  BillingQuoteInput,
  BillingQuoteProduct,
} from "@/app/api/shared/billing/billingQuoteTypes"
import type { IBillingQuoteService } from "./IBillingQuoteService"

function roundCurrency(value: number): number {
  return Number(value.toFixed(2))
}

function createProduct(
  catalogItem: BillingQuoteCatalogItem,
  quantity: number
): BillingQuoteProduct {
  return {
    ...catalogItem,
    quantity,
    totalAmount: roundCurrency(catalogItem.unitAmount * quantity),
  }
}

export class BillingQuoteService implements IBillingQuoteService {
  createQuote(input: BillingQuoteInput): BillingQuote {
    const contractedExtraUsers = Math.max(
      0,
      input.includedExtraUsers + input.manualAdjustmentExtraUsers
    )
    const contractedExtraTeams = Math.max(
      0,
      input.includedExtraTeams + input.manualAdjustmentExtraTeams
    )
    const usedExtraUsers = Math.max(0, input.billableActiveMembers - 1)
    const usedExtraTeams = Math.max(0, input.activeTeams - 1)
    const additionalUsers = input.hasUnlimitedUsers
      ? 0
      : Math.max(usedExtraUsers, contractedExtraUsers)
    const additionalTeams = Math.max(usedExtraTeams, contractedExtraTeams)
    const blockingReasons: string[] = [...(input.externalBlockingReasons ?? [])]

    if (!input.billingCycle) {
      blockingReasons.push("Ciclo de cobrança ausente ou inválido")
    }
    if (
      input.currentAsaasAmount !== null &&
      (!Number.isFinite(input.currentAsaasAmount) || input.currentAsaasAmount <= 0)
    ) {
      blockingReasons.push("Valor da assinatura Asaas inválido")
    }

    if (!input.hasPermanentSubscription && !input.baseProduct) {
      blockingReasons.push("Produto base sem preço vigente")
    }
    if (additionalUsers > 0 && !input.extraUserProduct) {
      blockingReasons.push("Produto de usuário adicional sem preço vigente")
    }
    if (additionalTeams > 0 && !input.extraTeamProduct) {
      blockingReasons.push("Produto de time adicional sem preço vigente")
    }

    const products: BillingQuoteProduct[] = []
    if (!input.hasPermanentSubscription && input.baseProduct) {
      products.push(createProduct(input.baseProduct, 1))
    }
    if (additionalUsers > 0 && input.extraUserProduct) {
      products.push(createProduct(input.extraUserProduct, additionalUsers))
    }
    if (additionalTeams > 0 && input.extraTeamProduct) {
      products.push(createProduct(input.extraTeamProduct, additionalTeams))
    }

    const adjustments: BillingQuoteAdjustment[] = []
    const productAmount = products.reduce((total, product) => total + product.totalAmount, 0)
    const recurringAmount = roundCurrency(productAmount)
    const isAligned =
      input.currentAsaasAmount !== null &&
      roundCurrency(input.currentAsaasAmount) === recurringAmount

    return {
      billingOwnerId: input.billingOwnerId,
      billingCycle: input.billingCycle,
      products,
      billableActiveMembers: Math.max(1, input.billableActiveMembers),
      additionalTeams,
      adjustments,
      recurringAmount,
      currentAsaasAmount: input.currentAsaasAmount,
      status: blockingReasons.length > 0 ? "blocked" : isAligned ? "aligned" : "divergent",
      blockingReasons,
    }
  }
}
