import {
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
 * Motivos que impedem tornar a instância o padrão, como o servidor os calcula
 * (`defaultBlockers`): a regra de elegibilidade é do backend e a tela só a mostra.
 * Instâncias somente de credencial nunca podem ser o padrão (PAY-CRED-T019).
 */
export function getDefaultBlockers(instance: ProviderInstanceView): readonly string[] {
  return instance.isDefault ? [] : instance.defaultBlockers
}

export function canMakeDefault(instance: ProviderInstanceView): boolean {
  return !instance.isDefault && getDefaultBlockers(instance).length === 0
}

/** Configurações exibidas: as que o servidor declara aplicáveis ao adapter da instância. */
export function getApplicableSettings(instance: ProviderInstanceView): readonly ApplicableSetting[] {
  return instance.applicableSettings
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
