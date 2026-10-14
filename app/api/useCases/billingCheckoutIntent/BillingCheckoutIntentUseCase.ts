import {
  BillingCheckoutIntentService,
} from "@/app/api/services/billingCheckoutIntent/BillingCheckoutIntentService"
import { billingPriceResolver } from "@/app/api/services/billingPricing/BillingPriceResolver"
import { billingCheckoutIntentRepository } from "@/app/api/infra/data/repositories/billingCheckoutIntent/BillingCheckoutIntentRepository"
import { Output } from "@/lib/output"

export class BillingCheckoutIntentUseCase {
  constructor(
    private readonly service: BillingCheckoutIntentService = new BillingCheckoutIntentService(
      billingCheckoutIntentRepository,
      billingPriceResolver,
    ),
  ) {}

  async getPublicDetails(token: string): Promise<Output> {
    return new Output(true, [], [], await this.service.getPublicDetails(token))
  }

  async createCheckout(token: string, billingType: string): Promise<Output> {
    return new Output(true, [], [], await this.service.createCheckout(token, billingType))
  }
}

export const billingCheckoutIntentUseCase = new BillingCheckoutIntentUseCase()
