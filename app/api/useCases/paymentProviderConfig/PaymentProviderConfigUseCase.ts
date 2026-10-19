import { Output } from "@/lib/output"
import type { IPaymentProviderConfigService } from "@/app/api/services/PaymentProviderConfig/IPaymentProviderConfigService"
import type {
  IPaymentProviderConfigUseCase,
  PaymentProviderConfigUseCaseInput,
} from "./IPaymentProviderConfigUseCase"

export class PaymentProviderConfigUseCase implements IPaymentProviderConfigUseCase {
  constructor(private readonly service: IPaymentProviderConfigService) {}

  async list(input: PaymentProviderConfigUseCaseInput): Promise<Output> {
    try {
      const configurations = await this.service.list(input.environment)
      return new Output(true, [], [], configurations)
    } catch (error) {
      console.error("[PaymentProviderConfigUseCase][list]", error)
      return new Output(false, [], ["Não foi possível carregar a configuração dos providers"], null)
    }
  }

  async update(
    input: PaymentProviderConfigUseCaseInput & {
      readonly provider: NonNullable<PaymentProviderConfigUseCaseInput["provider"]>
      readonly patch: NonNullable<PaymentProviderConfigUseCaseInput["patch"]>
    },
  ): Promise<Output> {
    try {
      const configuration = await this.service.update({
        provider: input.provider,
        environment: input.environment,
        patch: input.patch,
      })
      return new Output(true, ["Configuração atualizada"], [], configuration)
    } catch (error) {
      console.error("[PaymentProviderConfigUseCase][update]", error)
      const message =
        error instanceof Error ? error.message : "Não foi possível atualizar a configuração"
      return new Output(false, [], [message], null)
    }
  }
}
