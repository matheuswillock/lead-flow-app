import type { IPaymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/IPaymentProviderConfigRepository"
import type {
  IPaymentProviderConfigService,
  UpdatePaymentProviderConfigServiceInput,
} from "./IPaymentProviderConfigService"

export class PaymentProviderConfigService implements IPaymentProviderConfigService {
  constructor(private readonly repository: IPaymentProviderConfigRepository) {}

  list(environment: Parameters<IPaymentProviderConfigRepository["list"]>[0]) {
    return this.repository.list(environment)
  }

  update(input: UpdatePaymentProviderConfigServiceInput) {
    if (input.patch.publicKey !== undefined && input.provider !== "ABACATE_PAY") {
      throw new Error("A chave pública só pode ser configurada para o Abacate Pay")
    }
    for (const variable of input.patch.variables ?? []) {
      const prefix = `${input.provider}_${input.environment}_`
      if (!variable.name.startsWith(prefix)) {
        throw new Error("A variável precisa pertencer ao provider e ambiente selecionados")
      }
    }
    return this.repository.update(input)
  }
}
