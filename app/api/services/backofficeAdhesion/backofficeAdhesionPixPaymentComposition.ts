import { backofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/BackofficeAdhesionPaymentRepository"
import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import {
  BackofficeAdhesionPixPaymentService,
  type AdhesionPixGateway,
} from "./BackofficeAdhesionPixPaymentService"

/**
 * O provider é resolvido sob demanda (import dinâmico): construir o serviço não exige as
 * credenciais do provider nem carrega a composition de pagamentos nos fluxos que não geram PIX.
 */
export function createAbacateAdhesionPixGateway(): AdhesionPixGateway {
  return {
    async select() {
      const composition = await import(
        "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
      )
      const environment = composition.resolvePaymentProviderEnvironment()
      const selected = await composition.createPaymentProviderRouter(environment).select({
        environment,
        requiredCapabilities: ["ONE_TIME_PAYMENT", "PIX"],
      })
      return {
        provider: selected.provider,
        environment: selected.environment,
        externalAccountContext: selected.externalAccountContext,
      }
    },
    async createPix(input) {
      const composition = await import(
        "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
      )
      const environment = composition.resolvePaymentProviderEnvironment()
      return composition.createAbacatePayProvider(environment).createPixPayment(input)
    },
  }
}

export function createBackofficeAdhesionPixPaymentService() {
  return new BackofficeAdhesionPixPaymentService({
    payments: backofficeAdhesionPaymentRepository,
    sessions: paymentProviderSessionRepository,
    gateway: createAbacateAdhesionPixGateway(),
  })
}
