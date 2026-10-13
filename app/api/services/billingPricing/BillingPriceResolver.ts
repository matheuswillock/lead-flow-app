import { BackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/BackofficeProductRepository"
import type { IBackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/IBackofficeProductRepository"
import type { IBillingPriceResolver, BillingPriceInput } from "@/app/api/shared/billing/billingPriceTypes"

export class BillingPriceResolver implements IBillingPriceResolver {
  constructor(
    private readonly productRepository: IBackofficeProductRepository = new BackofficeProductRepository(),
  ) {}

  async resolvePrice(input: BillingPriceInput): Promise<number | null> {
    const product = input.productId
      ? await this.productRepository.findByIdWithPaymentRules(input.productId)
      : await this.findUnambiguousDefaultProduct(input.featureSlug)
    if (!product?.isActive || input.method === "BOLETO") return null

    const rule = product.paymentRules.find(
      (paymentRule) =>
        paymentRule.billingCycle === input.cycle && paymentRule.paymentMethod === input.method,
    )
    if (!rule) return null

    const price = Number(rule.price)
    return Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : null
  }

  private async findUnambiguousDefaultProduct(featureSlug: string) {
    const candidates = await this.productRepository.findByFeatureSlugWithPaymentRules(featureSlug)
    const defaults = candidates.filter((candidate) => candidate.isDefault && candidate.isActive)
    return defaults.length === 1 ? defaults[0] : null
  }
}

export const billingPriceResolver = new BillingPriceResolver()
