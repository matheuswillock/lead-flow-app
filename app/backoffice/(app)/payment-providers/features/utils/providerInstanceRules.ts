import {
  ROLLOUT_LABELS,
  type ApplicableSetting,
  type ProviderAdapterView,
  type ProviderCredentialView,
  type ProviderInstanceView,
} from "../context/BackofficePaymentProvidersTypes"

export function findCurrentDefault(
  instances: ProviderInstanceView[]
): ProviderInstanceView | null {
  return instances.find((instance) => instance.isDefault) ?? null
}

/**
 * Credenciais que são política (configuração), não segredo: a UI as controla por
 * interruptores e nunca as lista como campo de credencial.
 */
const POLICY_CREDENTIAL_KEYS = new Set(["REQUIRE_SIGNATURE", "CARD_PAYMENTS_ENABLED"])

function isSecretCredentialKey(key: string): boolean {
  return !POLICY_CREDENTIAL_KEYS.has(key)
}

export function missingRequiredCredentials(instance: ProviderInstanceView): string[] {
  return instance.credentials
    .filter((c) => c.required && !c.isSet && isSecretCredentialKey(c.key))
    .map((c) => c.key)
}

/**
 * Motivos que impedem tornar a instância o padrão. Usa o que o servidor informou
 * (`defaultBlockers`) e, na ausência, calcula o equivalente localmente.
 * Instâncias somente de credencial nunca podem ser o padrão (PAY-CRED-T019).
 */
export function getDefaultBlockers(instance: ProviderInstanceView): string[] {
  if (instance.isDefault) return []
  if (instance.defaultBlockers !== undefined) return instance.defaultBlockers

  const blockers: string[] = []
  if (!instance.paymentCapable) {
    blockers.push(
      "Somente credenciais: o adapter ainda não declara capacidades de pagamento, então o roteador não o seleciona."
    )
  }
  if (!instance.enabled) blockers.push("A instância está desativada.")
  if (instance.killSwitch) blockers.push("O kill switch está ativo.")
  if (instance.rolloutState !== "ACTIVE") {
    blockers.push(`O rollout está em “${ROLLOUT_LABELS[instance.rolloutState]}”; precisa estar em “Ativo”.`)
  }
  const missing = missingRequiredCredentials(instance)
  if (missing.length > 0) {
    blockers.push(`Credenciais obrigatórias faltando: ${missing.join(", ")}.`)
  }
  return blockers
}

export function canMakeDefault(instance: ProviderInstanceView): boolean {
  return !instance.isDefault && getDefaultBlockers(instance).length === 0
}

/** Configurações exibidas: as informadas pelo servidor; sem a informação, só adapters com pagamento. */
export function getApplicableSettings(instance: ProviderInstanceView): ApplicableSetting[] {
  if (instance.applicableSettings !== undefined) return instance.applicableSettings
  return instance.paymentCapable ? ["requireSignature", "cardEnabled"] : []
}

export interface CredentialRow extends ProviderCredentialView {
  label: string
  hint: string | null
  secret: boolean
}

/** Cruza o schema do adapter com o estado da instância; chaves extras entram ao final. */
export function buildCredentialRows(
  instance: ProviderInstanceView,
  adapter: ProviderAdapterView | undefined
): CredentialRow[] {
  const byKey = new Map(instance.credentials.filter((c) => isSecretCredentialKey(c.key)).map((c) => [c.key, c]))
  const secretFields = (adapter?.credentialSchema ?? []).filter((field) => isSecretCredentialKey(field.key))
  const rows: CredentialRow[] = secretFields.map((field) => {
    const state = byKey.get(field.key)
    byKey.delete(field.key)
    return {
      key: field.key,
      label: field.label,
      hint: field.hint,
      secret: field.secret,
      required: field.required,
      isSet: state?.isSet ?? false,
      last4: state?.last4 ?? null,
      fingerprint: state?.fingerprint ?? null,
      updatedAt: state?.updatedAt ?? null,
    }
  })
  for (const extra of byKey.values()) {
    rows.push({ ...extra, label: extra.key, hint: null, secret: true })
  }
  return rows
}

export function replaceInstance(
  instances: ProviderInstanceView[],
  updated: ProviderInstanceView
): ProviderInstanceView[] {
  const next = instances.map((item) => {
    if (item.id === updated.id) return updated
    // Só uma instância é padrão por ambiente.
    return updated.isDefault && item.environment === updated.environment
      ? { ...item, isDefault: false }
      : item
  })
  return next.some((item) => item.id === updated.id) ? next : [...next, updated]
}
