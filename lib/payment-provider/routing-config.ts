import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"
import type { ProviderRolloutState } from "./routing"

export type ProviderHealthStatus = "UNKNOWN" | "HEALTHY" | "UNHEALTHY"

export type ProviderRoutingConfigRecord = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly enabled: boolean
  readonly isDefault: boolean
  readonly externalAccountContext: string
  readonly rolloutState: ProviderRolloutState
  readonly killSwitch: boolean
  readonly revision: number
  readonly healthStatus: ProviderHealthStatus
}

export type ProviderRoutingConfigPatch = {
  readonly enabled?: boolean
  readonly isDefault?: boolean
  readonly externalAccountContext?: string
  readonly rolloutState?: ProviderRolloutState
  readonly killSwitch?: boolean
  readonly expectedRevision: number
}

export type ProviderRoutingConfigErrorCode =
  | "REVISION_CONFLICT"
  | "ROLLOUT_INVALID"
  | "ACCOUNT_CONTEXT_INVALID"

export class ProviderRoutingConfigError extends Error {
  constructor(
    readonly code: ProviderRoutingConfigErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "ProviderRoutingConfigError"
  }
}

export function applyProviderRoutingConfigPatch(
  current: ProviderRoutingConfigRecord,
  patch: ProviderRoutingConfigPatch,
): ProviderRoutingConfigRecord {
  if (patch.expectedRevision !== current.revision) {
    throw new ProviderRoutingConfigError(
      "REVISION_CONFLICT",
      "A revisão da configuração está desatualizada",
    )
  }
  const next = { ...current, ...patch, revision: current.revision + 1 }
  const accountContext = next.externalAccountContext.trim()
  if (!accountContext) {
    throw new ProviderRoutingConfigError(
      "ACCOUNT_CONTEXT_INVALID",
      "O contexto da conta do provider é obrigatório",
    )
  }
  if (
    next.environment === "PRODUCTION" &&
    next.rolloutState === "ACTIVE" &&
    current.rolloutState !== "APPROVED" &&
    current.rolloutState !== "ACTIVE"
  ) {
    throw new ProviderRoutingConfigError(
      "ROLLOUT_INVALID",
      "Produção exige validação e aprovação antes de ACTIVE",
    )
  }
  if (
    next.killSwitch &&
    next.rolloutState === "ACTIVE" &&
    current.rolloutState !== "ACTIVE"
  ) {
    throw new ProviderRoutingConfigError(
      "ROLLOUT_INVALID",
      "Não é possível ativar um provider com kill switch",
    )
  }
  if (!isValidRolloutTransition(current.rolloutState, next.rolloutState)) {
    throw new ProviderRoutingConfigError(
      "ROLLOUT_INVALID",
      "O rollout deve avançar por SANDBOX_VALIDATED, APPROVED e ACTIVE",
    )
  }
  const accountContextChanged = accountContext !== current.externalAccountContext
  return Object.freeze({
    provider: current.provider,
    environment: current.environment,
    enabled: accountContextChanged ? false : next.enabled,
    isDefault: next.isDefault,
    externalAccountContext: accountContext,
    rolloutState: accountContextChanged ? "DISABLED" : next.rolloutState,
    killSwitch: next.killSwitch,
    revision: next.revision,
    healthStatus: accountContextChanged ? "UNKNOWN" : current.healthStatus,
  })
}

function isValidRolloutTransition(
  current: ProviderRolloutState,
  next: ProviderRolloutState,
): boolean {
  if (next === current || next === "DISABLED") return true
  const nextByState: Readonly<Record<ProviderRolloutState, ProviderRolloutState>> = {
    DISABLED: "SANDBOX_VALIDATED",
    SANDBOX_VALIDATED: "APPROVED",
    APPROVED: "ACTIVE",
    ACTIVE: "ACTIVE",
  }
  return nextByState[current] === next
}
