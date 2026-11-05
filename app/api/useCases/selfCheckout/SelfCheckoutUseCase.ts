import type { IBackofficeAdhesionService } from "@/app/api/services/backofficeAdhesion/IBackofficeAdhesionService"
import { Output } from "@/lib/output"
import { SelfCheckoutError, type SelfCheckoutRequest } from "@/lib/self-checkout/contracts"
import type { ISelfCheckoutProviderGate, ISelfCheckoutUseCase } from "./ISelfCheckoutUseCase"

const GENERIC_CREATE_ERROR = "Não foi possível iniciar a compra. Tente novamente."
const GENERIC_OPTIONS_ERROR = "Não foi possível carregar os planos."

function failedFromSelfCheckoutError(error: SelfCheckoutError): Output {
  return new Output(false, [], [error.message], { code: error.code })
}

export class SelfCheckoutUseCase implements ISelfCheckoutUseCase {
  constructor(
    private readonly service: Pick<
      IBackofficeAdhesionService,
      "getSelfCheckoutOptions" | "createSelfCheckout"
    >,
    private readonly providerGate: ISelfCheckoutProviderGate,
  ) {}

  async getOptions(): Promise<Output> {
    try {
      return new Output(true, [], [], await this.service.getSelfCheckoutOptions())
    } catch (error) {
      console.error("[SelfCheckoutUseCase][getOptions]", error)
      return new Output(false, [], [GENERIC_OPTIONS_ERROR], null)
    }
  }

  async create(input: SelfCheckoutRequest): Promise<Output> {
    try {
      await this.providerGate.assertAvailable()
      return new Output(true, [], [], await this.service.createSelfCheckout(input))
    } catch (error) {
      if (error instanceof SelfCheckoutError) return failedFromSelfCheckoutError(error)
      // Sem dados pessoais no log: só o nome do erro, nunca a mensagem (pode conter e-mail).
      console.error("[SelfCheckoutUseCase][create]", error instanceof Error ? error.name : "erro")
      return new Output(false, [], [GENERIC_CREATE_ERROR], null)
    }
  }
}
