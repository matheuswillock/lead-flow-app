import type {
  ProviderAdapterView,
  ProviderCredentialView,
  ProviderInstanceView,
} from "../context/BackofficePaymentProvidersTypes"

export function findCurrentDefault(
  instances: ProviderInstanceView[]
): ProviderInstanceView | null {
  return instances.find((instance) => instance.isDefault) ?? null
}

/** Instâncias somente de credencial nunca podem ser o padrão (PAY-CRED-T019). */
export function canMakeDefault(instance: ProviderInstanceView): boolean {
  return instance.paymentCapable && !instance.isDefault
}

export function makeDefaultBlockedReason(instance: ProviderInstanceView): string | null {
  if (!instance.paymentCapable) {
    return "Somente credenciais: o adapter ainda não declara capacidades de pagamento, então o roteador não o seleciona."
  }
  if (instance.isDefault) return "Esta instância já é o padrão do ambiente."
  return null
}

export function missingRequiredCredentials(instance: ProviderInstanceView): string[] {
  return instance.credentials.filter((c) => c.required && !c.isSet).map((c) => c.key)
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
  const byKey = new Map(instance.credentials.map((c) => [c.key, c]))
  const rows: CredentialRow[] = (adapter?.credentialSchema ?? []).map((field) => {
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
