import { BillingQuoteRepository } from "@/app/api/infra/data/repositories/billingQuote/BillingQuoteRepository"
import { BackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/BackofficeProductRepository"
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService"
import { BillingQuoteService } from "@/app/api/services/billingQuote/BillingQuoteService"
import { CreateBillingQuoteUseCase } from "./CreateBillingQuoteUseCase"

export const billingQuoteUseCase = new CreateBillingQuoteUseCase({
  repository: new BillingQuoteRepository(new BackofficeProductRepository()),
  asaasSubscriptionService: new AsaasSubscriptionService(),
  quoteService: new BillingQuoteService(),
})
