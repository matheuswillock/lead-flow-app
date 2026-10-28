import type { ProviderRolloutState } from "@/lib/payment-provider/routing"
import type { ProviderRoutingConfigPatch } from "@/lib/payment-provider/routing-config"

const ROLLOUT_STATES: readonly string[] = ["DISABLED", "SANDBOX_VALIDATED", "APPROVED", "ACTIVE"]

type MutablePatch = {
  -readonly [Key in keyof ProviderRoutingConfigPatch]: ProviderRoutingConfigPatch[Key]
}

const BOOLEAN_FIELDS = ["enabled", "isDefault", "killSwitch", "cardEnabled"] as const

/** Valida o corpo do PUT; qualquer campo com tipo inesperado invalida o patch inteiro. */
export function parseProviderConfigPatch(value: unknown): ProviderRoutingConfigPatch | null {
  if (
    !isRecord(value) ||
    typeof value.expectedRevision !== "number" ||
    !Number.isInteger(value.expectedRevision)
  ) {
    return null
  }
  const patch: MutablePatch = { expectedRevision: value.expectedRevision }
  for (const field of BOOLEAN_FIELDS) {
    const fieldValue = value[field]
    if (fieldValue === undefined) continue
    if (typeof fieldValue !== "boolean") return null
    patch[field] = fieldValue
  }
  if (value.externalAccountContext !== undefined) {
    if (typeof value.externalAccountContext !== "string") return null
    patch.externalAccountContext = value.externalAccountContext
  }
  if (value.rolloutState !== undefined) {
    if (typeof value.rolloutState !== "string" || !ROLLOUT_STATES.includes(value.rolloutState)) {
      return null
    }
    patch.rolloutState = value.rolloutState as ProviderRolloutState
  }
  return patch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
