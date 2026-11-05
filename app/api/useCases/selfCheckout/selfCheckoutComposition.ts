import { backofficeAdhesionService } from "@/app/api/services/backofficeAdhesion/BackofficeAdhesionService"
import { createAbacateAdhesionPixGateway } from "@/app/api/services/backofficeAdhesion/backofficeAdhesionPixPaymentComposition"
import { SelfCheckoutUseCase } from "./SelfCheckoutUseCase"
import { createSelfCheckoutProviderGate } from "./selfCheckoutProviderGate"

export const selfCheckoutUseCase = new SelfCheckoutUseCase(
  backofficeAdhesionService,
  createSelfCheckoutProviderGate(createAbacateAdhesionPixGateway()),
)
