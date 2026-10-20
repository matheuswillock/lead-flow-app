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
    return this.repository.update(input)
  }
}
