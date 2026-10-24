import type { PaymentProviderMetadata } from "./contracts"
import type { PaymentCapability, PaymentProviderEnvironment, PaymentProviderKey } from "./types"

export type ProviderRolloutState = "DISABLED" | "SANDBOX_VALIDATED" | "APPROVED" | "ACTIVE"

export type ProviderRoutingConfig = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly enabled: boolean
  readonly isDefault: boolean
  readonly rolloutState: ProviderRolloutState
  readonly killSwitch: boolean
  readonly externalAccountContext: string
  readonly revision: number
  readonly healthStatus: "UNKNOWN" | "HEALTHY" | "UNHEALTHY"
}

export type SelectProviderInput = {
  readonly environment: PaymentProviderEnvironment
  readonly requiredCapabilities: readonly PaymentCapability[]
  readonly configurations: readonly ProviderRoutingConfig[]
  /** Metadata comes from server-owned adapters, never from the request. */
  readonly providerMetadata: readonly PaymentProviderMetadata[]
}

export type SelectedProvider = Readonly<ProviderRoutingConfig>

export type ProviderRoutingErrorCode =
  | "PROVIDER_NOT_AVAILABLE"
  | "PROVIDER_DEFAULT_INVALID"
  | "PROVIDER_DEFAULT_REQUIRED"
  | "PROVIDER_CONFIGURATION_INVALID"

export class ProviderRoutingError extends Error {
  constructor(
    readonly code: ProviderRoutingErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "ProviderRoutingError"
  }
}

export function selectProviderForNewPayment(input: SelectProviderInput): SelectedProvider {
  const environmentConfigurations = input.configurations.filter(
    (configuration) => configuration.environment === input.environment,
  )
  const configuredDefaults = environmentConfigurations.filter(
    (configuration) => configuration.isDefault,
  )
  if (configuredDefaults.length > 1) {
    throw new ProviderRoutingError(
      "PROVIDER_CONFIGURATION_INVALID",
      "Há mais de um provider padrão configurado",
    )
  }
  const configuredDefault = configuredDefaults[0]
  const eligibleConfigurations = environmentConfigurations.filter((configuration) =>
    isEligibleForOperation(configuration, input),
  )

  if (eligibleConfigurations.length === 0) {
    throw new ProviderRoutingError("PROVIDER_NOT_AVAILABLE", "Nenhum provider elegível")
  }

  if (configuredDefault) {
    if (!isEligibleForOperation(configuredDefault, input)) {
      throw new ProviderRoutingError("PROVIDER_DEFAULT_INVALID", "O provider padrão não é elegível")
    }
    return freezeConfiguration(configuredDefault)
  }

  if (eligibleConfigurations.length > 1) {
    throw new ProviderRoutingError(
      "PROVIDER_DEFAULT_REQUIRED",
      "É necessário configurar um provider padrão",
    )
  }

  return freezeConfiguration(eligibleConfigurations[0])
}

/** Critérios de elegibilidade da própria instância (sem capacidades): o roteador e a escolha da principal usam os mesmos. */
export function isConfigurationRoutable(
  configuration: Pick<
    ProviderRoutingConfig,
    "enabled" | "killSwitch" | "rolloutState" | "healthStatus" | "externalAccountContext" | "revision"
  >,
): boolean {
  if (
    !configuration.enabled ||
    configuration.killSwitch ||
    configuration.rolloutState !== "ACTIVE"
  ) {
    return false
  }
  if (configuration.healthStatus !== "HEALTHY") return false
  return Boolean(configuration.externalAccountContext.trim()) && configuration.revision >= 1
}

function isEligibleForOperation(
  configuration: ProviderRoutingConfig,
  input: SelectProviderInput,
): boolean {
  if (!isConfigurationRoutable(configuration)) return false
  const metadata = input.providerMetadata.find(
    (candidate) =>
      candidate.key === configuration.provider &&
      candidate.environment === configuration.environment,
  )
  if (!metadata) return false
  return input.requiredCapabilities.every((capability) =>
    metadata.capabilities.includes(capability),
  )
}

function freezeConfiguration(configuration: ProviderRoutingConfig): SelectedProvider {
  return Object.freeze({
    ...configuration,
  })
}
