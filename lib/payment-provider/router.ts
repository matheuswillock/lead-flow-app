import type { PaymentProviderMetadata } from "./contracts"
import type { IPaymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/IPaymentProviderConfigRepository"
import {
  selectProviderForNewPayment,
  type SelectProviderInput,
  type SelectedProvider,
} from "./routing"
import { PaymentProviderRegistry } from "./registry"

export type SelectRoutedProviderInput = Omit<
  SelectProviderInput,
  "configurations" | "providerMetadata"
>

export class PaymentProviderRouter {
  constructor(
    private readonly configRepository: Pick<IPaymentProviderConfigRepository, "list">,
    private readonly registry: PaymentProviderRegistry,
  ) {}

  async select(input: SelectRoutedProviderInput): Promise<SelectedProvider> {
    const configurations = await this.configRepository.list(input.environment)
    const providerMetadata: readonly PaymentProviderMetadata[] = this.registry.list(
      input.environment,
    )
    return selectProviderForNewPayment({ ...input, configurations, providerMetadata })
  }
}
