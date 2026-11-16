import type { ProviderRolloutState } from "@/lib/payment-provider/routing"
import type { ProviderConfigVariableInput, ProviderRoutingConfigPatch } from "@/lib/payment-provider/routing-config"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

const ROLLOUT_STATES: readonly string[] = ["DISABLED", "SANDBOX_VALIDATED", "APPROVED", "ACTIVE"]

type MutablePatch = {
  -readonly [Key in keyof ProviderRoutingConfigPatch]: ProviderRoutingConfigPatch[Key]
}

const BOOLEAN_FIELDS = ["enabled", "isDefault", "killSwitch", "cardEnabled"] as const

/** Valida o corpo do PUT; qualquer campo com tipo inesperado invalida o patch inteiro. */
export function parseProviderConfigPatch(
  value: unknown,
  provider: PaymentProviderKey,
  environment: PaymentProviderEnvironment,
): ProviderRoutingConfigPatch | null {
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
  if (value.publicKey !== undefined) {
    if (value.publicKey !== null && (typeof value.publicKey !== "string" || !/^pk_[A-Za-z0-9_-]{8,512}$/.test(value.publicKey.trim()))) return null
    patch.publicKey = typeof value.publicKey === "string" ? value.publicKey.trim() || null : null
  }
  if (value.variables !== undefined) {
    const variables = parseProviderConfigVariables(value.variables, provider, environment)
    if (!variables) return null
    patch.variables = variables
  }
  if (value.rolloutState !== undefined) {
    if (typeof value.rolloutState !== "string" || !ROLLOUT_STATES.includes(value.rolloutState)) {
      return null
    }
    patch.rolloutState = value.rolloutState as ProviderRolloutState
  }
  return patch
}

function parseProviderConfigVariables(
  value: unknown,
  provider: PaymentProviderKey,
  environment: PaymentProviderEnvironment,
): ProviderConfigVariableInput[] | null {
  if (!Array.isArray(value) || value.length > 50) return null
  const prefix = `${provider}_${environment}_`
  const variables: ProviderConfigVariableInput[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== "string" || !item.name.startsWith(prefix) ||
      !/^[A-Z][A-Z0-9_]{1,127}$/.test(item.name) || seen.has(item.name) ||
      (item.visibility !== "PUBLIC" && item.visibility !== "SECRET")) return null
    if (item.value !== undefined && (typeof item.value !== "string" || item.value.length > 8192)) return null
    if (item.visibility === "PUBLIC" && (typeof item.value !== "string" || !item.value.trim())) return null
    variables.push({
      name: item.name,
      visibility: item.visibility,
      ...(typeof item.value === "string" ? { value: item.value } : {}),
    })
    seen.add(item.name)
  }
  return variables
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
