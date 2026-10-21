import type { PaymentProviderMetadata } from "./contracts"
import type { ProviderRoutingConfigRecord } from "./routing-config"
import type { PaymentProviderEnvironment } from "./types"
import {
  selectProviderForNewPayment,
  type SelectProviderInput,
  type SelectedProvider,
} from "./routing"
import { PaymentProviderRegistry } from "./registry"
import type { PaymentOwnerContext } from "@/lib/payments/types"

export type SelectRoutedProviderInput = Omit<
  SelectProviderInput,
  "configurations" | "providerMetadata"
> & {
  /** Dono da cobrança. Reservado para a decisão por coorte (Rodada 2); hoje não altera a seleção. */
  readonly ownerContext?: PaymentOwnerContext
}

export class PaymentProviderRouter {
  constructor(
    private readonly configRepository: {
      list(environment: PaymentProviderEnvironment): Promise<readonly ProviderRoutingConfigRecord[]>
    },
    private readonly registry: PaymentProviderRegistry,
  ) {}

  async select(input: SelectRoutedProviderInput): Promise<SelectedProvider> {
    const { ownerContext: _ownerContext, ...selection } = input
    const configurations = await this.configRepository.list(selection.environment)
    const providerMetadata: readonly PaymentProviderMetadata[] = this.registry.list(
      selection.environment,
    )
    return selectProviderForNewPayment({ ...selection, configurations, providerMetadata })
  }
}
