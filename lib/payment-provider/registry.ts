import type { PaymentProviderMetadata } from "./contracts"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

export type PaymentProviderAdapterReference = {
  readonly metadata: PaymentProviderMetadata
}

export class PaymentProviderRegistry {
  private readonly adapters: readonly PaymentProviderAdapterReference[]

  constructor(adapters: readonly PaymentProviderAdapterReference[]) {
    assertNoDuplicateAdapters(adapters)
    this.adapters = Object.freeze([...adapters])
  }

  list(environment: PaymentProviderEnvironment): readonly PaymentProviderMetadata[] {
    return Object.freeze(
      this.adapters
        .filter((adapter) => adapter.metadata.environment === environment)
        .map((adapter) =>
          Object.freeze({
            ...adapter.metadata,
            capabilities: Object.freeze([...adapter.metadata.capabilities]),
          }),
        ),
    )
  }

  get(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
  ): PaymentProviderMetadata | null {
    const adapter = this.adapters.find(
      (candidate) =>
        candidate.metadata.key === provider && candidate.metadata.environment === environment,
    )
    return adapter ? cloneMetadata(adapter.metadata) : null
  }
}

function cloneMetadata(metadata: PaymentProviderMetadata): PaymentProviderMetadata {
  return Object.freeze({
    ...metadata,
    capabilities: Object.freeze([...metadata.capabilities]),
  })
}

function assertNoDuplicateAdapters(adapters: readonly PaymentProviderAdapterReference[]): void {
  const seen = new Set<string>()
  for (const adapter of adapters) {
    const key = `${adapter.metadata.key}:${adapter.metadata.environment}`
    if (seen.has(key)) throw new Error(`Adapter duplicado: ${key}`)
    seen.add(key)
  }
}
