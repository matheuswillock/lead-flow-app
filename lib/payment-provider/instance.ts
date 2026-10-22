import type {
  ProviderCredentialView,
  ProviderInstanceSettingsView,
  ProviderInstanceView,
  ProviderSettingKey,
} from "./admin-contract"
import { getAdapterDescriptor, isPaymentCapableProvider } from "./credential-schema"
import { isConfigurationRoutable } from "./routing"
import type { ProviderRoutingConfigRecord } from "./routing-config"

/** Configurações não secretas de uma instância. Campo ausente = não definido (cai na reserva). */
export type StoredProviderSettings = {
  readonly requireSignature?: boolean
  readonly cardEnabled?: boolean
}

export type ProviderInstanceRecord = ProviderRoutingConfigRecord & {
  readonly id: string
  readonly displayName: string
  readonly logoUrl: string | null
  readonly logoAltText: string | null
  readonly settings: StoredProviderSettings
  readonly lastHealthCheckAt: Date | null
  readonly lastErrorCode: string | null
}

export type ProviderCredentialMeta = {
  readonly key: string
  readonly last4: string | null
  readonly fingerprint: string
  readonly updatedAt: Date
}

export class ProviderInstanceValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProviderInstanceValidationError"
  }
}

const MAX_DISPLAY_NAME = 80
const MAX_ALT_TEXT = 200
const MAX_LOGO_URL = 2048
/** Instância somente de credencial só pode ficar até aqui no rollout (PAY-CRED-T019). */
const CREDENTIAL_ONLY_MAX_ROLLOUT = new Set(["DISABLED", "SANDBOX_VALIDATED"])

export function parseStoredSettings(value: unknown): StoredProviderSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const settings: { requireSignature?: boolean; cardEnabled?: boolean } = {}
  if (typeof source.requireSignature === "boolean") settings.requireSignature = source.requireSignature
  if (typeof source.cardEnabled === "boolean") settings.cardEnabled = source.cardEnabled
  return settings
}

/** Valida a entrada de `settings`; chaves desconhecidas e tipos errados são rejeitados. */
export function validateSettingsPatch(value: unknown): StoredProviderSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProviderInstanceValidationError("settings inválido")
  }
  const settings: { requireSignature?: boolean; cardEnabled?: boolean } = {}
  for (const [key, raw] of Object.entries(value)) {
    if (key !== "requireSignature" && key !== "cardEnabled") {
      throw new ProviderInstanceValidationError(`settings.${key} não é suportado`)
    }
    if (typeof raw !== "boolean") {
      throw new ProviderInstanceValidationError(`settings.${key} deve ser booleano`)
    }
    settings[key] = raw
  }
  return settings
}

export function validateDisplayName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : ""
  if (!name || name.length > MAX_DISPLAY_NAME) {
    throw new ProviderInstanceValidationError("O nome de exibição é obrigatório (até 80 caracteres)")
  }
  return name
}

/** Logo precisa ser https; nada de javascript:, data:, credenciais embutidas ou hosts locais. */
export function validateLogoUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || value.length > MAX_LOGO_URL) {
    throw new ProviderInstanceValidationError("URL do logo inválida")
  }
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new ProviderInstanceValidationError("URL do logo inválida")
  }
  const host = parsed.hostname.toLowerCase()
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    !host.includes(".")
  ) {
    throw new ProviderInstanceValidationError("O logo deve usar uma URL https pública")
  }
  return parsed.toString()
}

export function validateLogoAltText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_ALT_TEXT) {
    throw new ProviderInstanceValidationError("Texto alternativo do logo inválido")
  }
  return value.trim()
}

/**
 * PAY-CRED-T019: instância de adapter sem capacidades de pagamento no router não pode ser
 * padrão nem avançar além de SANDBOX_VALIDATED, e não pode ficar habilitada para o router.
 */
export function assertInstanceRoutingPolicy(
  next: Pick<ProviderRoutingConfigRecord, "provider" | "isDefault" | "rolloutState" | "enabled">,
): void {
  if (isPaymentCapableProvider(next.provider)) return
  if (next.isDefault) {
    // Estado incompatível (409), como as demais recusas de padrão inelegível.
    throw new ProviderInstanceConflictError(
      "Instância somente de credencial não pode ser o provider padrão",
    )
  }
  if (!CREDENTIAL_ONLY_MAX_ROLLOUT.has(next.rolloutState)) {
    throw new ProviderInstanceValidationError(
      "Instância somente de credencial não pode avançar além de SANDBOX_VALIDATED",
    )
  }
}

export type ResolveCardEnabledFallback = () => boolean

export function toSettingsView(
  stored: StoredProviderSettings,
  cardEnabledFallback: boolean,
): ProviderInstanceSettingsView {
  return {
    requireSignature: stored.requireSignature ?? false,
    cardEnabled: stored.cardEnabled ?? cardEnabledFallback,
  }
}

export function toCredentialViews(
  providerKey: ProviderRoutingConfigRecord["provider"],
  metas: readonly ProviderCredentialMeta[],
): ProviderCredentialView[] {
  const byKey = new Map(metas.map((meta) => [meta.key, meta]))
  const declared = getAdapterDescriptor(providerKey).fields
  // Campos de política (ex.: REQUIRE_SIGNATURE) são controlados por `settings`, não por credencial.
  const editable = declared.filter((field) => !field.policy)
  const views: ProviderCredentialView[] = editable.map((field) =>
    toCredentialView(field.key, field.required, byKey.get(field.key)),
  )
  const declaredKeys = new Set(declared.map((field) => field.key))
  for (const meta of metas) {
    if (!declaredKeys.has(meta.key)) views.push(toCredentialView(meta.key, false, meta))
  }
  return views
}

/** Rejeita `settings` que não se aplicam ao adapter (ex.: cartão/assinatura numa instância Asaas). */
export function assertSettingsApplicable(
  providerKey: ProviderRoutingConfigRecord["provider"],
  settings: StoredProviderSettings,
): void {
  const descriptor = getAdapterDescriptor(providerKey)
  for (const key of Object.keys(settings)) {
    if (!descriptor.applicableSettings.includes(key as ProviderSettingKey)) {
      throw new ProviderInstanceValidationError(
        `A configuração "${key}" não se aplica ao adapter ${descriptor.label}`,
      )
    }
  }
}

const ROLLOUT_LABEL = "ACTIVE"

/**
 * Motivos pelos quais a instância ainda não pode ser o provider padrão. O padrão inelegível
 * BLOQUEIA todas as novas cobranças (não há fallback), então a promoção só passa sem motivos.
 * `envProvidedKeys` são as chaves obrigatórias cobertas pela reserva de ambiente (só vale para a
 * instância principal, conforme o resolver).
 */
export function computeDefaultBlockers(
  record: Pick<
    ProviderInstanceRecord,
    "provider" | "enabled" | "killSwitch" | "rolloutState"
  >,
  metas: readonly Pick<ProviderCredentialMeta, "key">[],
  envProvidedKeys: ReadonlySet<string> = new Set(),
): string[] {
  const descriptor = getAdapterDescriptor(record.provider)
  const blockers: string[] = []
  if (!descriptor.paymentCapable) {
    blockers.push(
      `O adapter ${descriptor.label} não tem capacidade de pagamento (instância somente de credencial).`,
    )
  }
  if (!record.enabled) blockers.push("A instância está desativada.")
  if (record.killSwitch) blockers.push("O kill switch está ligado.")
  if (record.rolloutState !== ROLLOUT_LABEL) {
    blockers.push(`O rollout precisa estar ACTIVE (atual: ${record.rolloutState}).`)
  }
  const stored = new Set(metas.map((meta) => meta.key))
  for (const field of descriptor.fields) {
    if (field.required && !stored.has(field.key) && !envProvidedKeys.has(field.key)) {
      blockers.push(`Falta a credencial obrigatória ${field.label} (${field.key}).`)
    }
  }
  return blockers
}

export function assertCanBeDefault(blockers: readonly string[]): void {
  if (blockers.length === 0) return
  throw new ProviderInstanceConflictError(
    `Esta instância ainda não pode ser o provider padrão: ${blockers.join(" ")}`,
  )
}

function toCredentialView(
  key: string,
  required: boolean,
  meta: ProviderCredentialMeta | undefined,
): ProviderCredentialView {
  return {
    key,
    isSet: meta !== undefined,
    last4: meta?.last4 ?? null,
    fingerprint: meta?.fingerprint ?? null,
    required,
    updatedAt: meta ? meta.updatedAt.toISOString() : null,
  }
}

export function toInstanceView(
  record: ProviderInstanceRecord,
  metas: readonly ProviderCredentialMeta[],
  cardEnabledFallback: boolean,
  envProvidedKeys: ReadonlySet<string> = new Set(),
): ProviderInstanceView {
  return {
    id: record.id,
    providerKey: record.provider,
    environment: record.environment,
    externalAccountContext: record.externalAccountContext,
    displayName: record.displayName,
    logoUrl: record.logoUrl,
    logoAltText: record.logoAltText,
    enabled: record.enabled,
    isDefault: record.isDefault,
    rolloutState: record.rolloutState,
    killSwitch: record.killSwitch,
    configRevision: record.revision,
    healthStatus: record.healthStatus,
    lastHealthCheckAt: record.lastHealthCheckAt ? record.lastHealthCheckAt.toISOString() : null,
    lastErrorCode: record.lastErrorCode,
    paymentCapable: isPaymentCapableProvider(record.provider),
    credentials: toCredentialViews(record.provider, metas),
    settings: toSettingsView(record.settings, cardEnabledFallback),
    applicableSettings: getAdapterDescriptor(record.provider).applicableSettings,
    defaultBlockers: computeDefaultBlockers(record, metas, envProvidedKeys),
  }
}

export class ProviderInstanceConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProviderInstanceConflictError"
  }
}

export class ProviderInstanceNotFoundError extends Error {
  constructor(message = "Instância do provider não encontrada") {
    super(message)
    this.name = "ProviderInstanceNotFoundError"
  }
}

type PrimaryCandidate = Pick<
  ProviderRoutingConfigRecord,
  | "provider"
  | "isDefault"
  | "enabled"
  | "killSwitch"
  | "rolloutState"
  | "healthStatus"
  | "externalAccountContext"
  | "revision"
>

/**
 * Instância principal de um provider, com os mesmos critérios do roteador: entre as elegíveis
 * (habilitada, sem kill switch, ACTIVE, HEALTHY, contexto preenchido) prefere a padrão. Sem nenhuma
 * elegível (bootstrap, webhook de instância já desligada) a reserva é padrão, habilitada, primeira.
 */
export function pickPrimaryInstance<T extends PrimaryCandidate>(
  instances: readonly T[],
  provider: ProviderRoutingConfigRecord["provider"],
): T | undefined {
  const candidates = instances.filter((instance) => instance.provider === provider)
  const eligible = candidates.filter(isConfigurationRoutable)
  return (
    eligible.find((instance) => instance.isDefault) ??
    eligible[0] ??
    candidates.find((instance) => instance.isDefault) ??
    candidates.find((instance) => instance.enabled) ??
    candidates[0]
  )
}
