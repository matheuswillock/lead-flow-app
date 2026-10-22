import type { ProviderHealthStatus } from "./routing-config"
import type { ProviderRolloutState } from "./routing"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

/**
 * Contrato da API administrativa de instâncias de provider
 * (`/api/v1/backoffice/payment-providers/config/**`). Usado pelo backend e pela UI do backoffice.
 * O valor de uma credencial NUNCA aparece em nenhum destes tipos.
 */

export type ProviderCredentialView = {
  readonly key: string
  readonly isSet: boolean
  readonly last4: string | null
  readonly fingerprint: string | null
  readonly required: boolean
  readonly updatedAt: string | null
}

export type ProviderInstanceSettingsView = {
  readonly requireSignature: boolean
  readonly cardEnabled: boolean
}

export type ProviderInstanceView = {
  readonly id: string
  readonly providerKey: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly displayName: string
  readonly logoUrl: string | null
  readonly logoAltText: string | null
  readonly enabled: boolean
  readonly isDefault: boolean
  readonly rolloutState: ProviderRolloutState
  readonly killSwitch: boolean
  readonly configRevision: number
  readonly healthStatus: ProviderHealthStatus
  readonly lastHealthCheckAt: string | null
  readonly lastErrorCode: string | null
  /** false: instância somente de credencial (o router não a seleciona para pagamentos). */
  readonly paymentCapable: boolean
  /** Credenciais editáveis (campos de política, como REQUIRE_SIGNATURE, ficam em `settings`). */
  readonly credentials: readonly ProviderCredentialView[]
  readonly settings: ProviderInstanceSettingsView
  /** Quais `settings` valem para o adapter; o PUT rejeita os demais. Asaas: nenhum. */
  readonly applicableSettings: readonly ProviderSettingKey[]
  /**
   * Motivos (PT-BR) pelos quais a instância ainda não pode ser o provider padrão; vazio quando
   * pode. O PUT com `isDefault=true` devolve 409 listando estes motivos.
   */
  readonly defaultBlockers: readonly string[]
}

export type ProviderSettingKey = "requireSignature" | "cardEnabled"

export type ProviderCredentialFieldView = {
  readonly key: string
  readonly label: string
  readonly required: boolean
  readonly secret: boolean
  readonly hint: string
}

export type ProviderAdapterView = {
  readonly providerKey: PaymentProviderKey
  readonly label: string
  readonly paymentCapable: boolean
  readonly applicableSettings: readonly ProviderSettingKey[]
  /** Sem campos de política (REQUIRE_SIGNATURE etc.): a UI os controla por `settings`. */
  readonly credentialSchema: readonly ProviderCredentialFieldView[]
}

export type ProviderAdaptersResponse = { readonly adapters: readonly ProviderAdapterView[] }

export type CreateProviderInstanceBody = {
  readonly providerKey: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly displayName: string
  readonly logoUrl?: string | null
  readonly logoAltText?: string | null
}

export type UpdateProviderInstanceBody = {
  readonly id: string
  readonly expectedRevision: number
  readonly enabled?: boolean
  readonly isDefault?: boolean
  readonly externalAccountContext?: string
  readonly rolloutState?: ProviderRolloutState
  readonly killSwitch?: boolean
  readonly displayName?: string
  readonly logoUrl?: string | null
  readonly logoAltText?: string | null
  readonly settings?: { readonly requireSignature?: boolean; readonly cardEnabled?: boolean }
}

export type SetProviderCredentialBody = {
  readonly configId: string
  readonly key: string
  /** Write-only: nunca devolvido em nenhuma resposta. */
  readonly value: string
}

export type ProviderHealthCheckBody = { readonly id: string }

export type ProviderHistoryItem = {
  readonly at: string
  readonly actor: string
  readonly operation: string
  readonly summary: string
}

export type ProviderHistoryResponse = { readonly items: readonly ProviderHistoryItem[] }

export const MAX_CREDENTIAL_VALUE_LENGTH = 4096
