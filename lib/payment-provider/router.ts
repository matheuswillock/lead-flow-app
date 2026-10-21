import type { PaymentProviderMetadata } from "./contracts"
import type { ProviderRoutingConfigRecord } from "./routing-config"
import type { PaymentProviderEnvironment } from "./types"
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
    private readonly configRepository: {
      list(environment: PaymentProviderEnvironment): Promise<readonly ProviderRoutingConfigRecord[]>
    },
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
