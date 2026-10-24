import type { ProviderHistoryItem } from "./admin-contract"
import type { ProviderInstanceRecord } from "./instance"

/**
 * Snapshots de auditoria de uma instância. Por construção, só contêm campos de roteamento e
 * metadados; credenciais entram apenas como `{ key, isSet, last4 }` (nunca o valor).
 */

export type InstanceAuditSnapshot = {
  readonly displayName: string
  readonly externalAccountContext: string
  readonly enabled: boolean
  readonly isDefault: boolean
  readonly rolloutState: string
  readonly killSwitch: boolean
  readonly logoUrl: string | null
  readonly logoAltText: string | null
  readonly requireSignature: boolean | null
  readonly cardEnabled: boolean | null
}

export type CredentialAuditSnapshot = {
  readonly key: string
  readonly isSet: boolean
  readonly last4: string | null
}

export function snapshotInstance(record: ProviderInstanceRecord): InstanceAuditSnapshot {
  return {
    displayName: record.displayName,
    externalAccountContext: record.externalAccountContext,
    enabled: record.enabled,
    isDefault: record.isDefault,
    rolloutState: record.rolloutState,
    killSwitch: record.killSwitch,
    logoUrl: record.logoUrl,
    logoAltText: record.logoAltText,
    requireSignature: record.settings.requireSignature ?? null,
    cardEnabled: record.settings.cardEnabled ?? null,
  }
}

export function changedFields(
  before: InstanceAuditSnapshot,
  after: InstanceAuditSnapshot,
): string[] {
  return (Object.keys(before) as Array<keyof InstanceAuditSnapshot>).filter(
    (field) => before[field] !== after[field],
  )
}

const OPERATION_LABELS: Record<string, string> = {
  provider_instance_created: "Instância criada",
  provider_instance_updated: "Instância alterada",
  provider_credential_created: "Credencial criada",
  provider_credential_rotated: "Credencial rotacionada",
  provider_credential_deleted: "Credencial removida",
}

export type AuditRowForHistory = {
  readonly createdAt: Date
  readonly actorProfileId: string | null
  readonly metadata: unknown
}

export function toHistoryItem(row: AuditRowForHistory): ProviderHistoryItem {
  const metadata = isRecord(row.metadata) ? row.metadata : {}
  const operation = typeof metadata.operation === "string" ? metadata.operation : "unknown"
  const actor =
    (typeof metadata.backofficeEmail === "string" && metadata.backofficeEmail) ||
    row.actorProfileId ||
    "sistema"
  return {
    at: row.createdAt.toISOString(),
    actor,
    operation,
    summary: buildSummary(operation, metadata),
  }
}

function buildSummary(operation: string, metadata: Record<string, unknown>): string {
  const label = OPERATION_LABELS[operation] ?? "Alteração"
  if (typeof metadata.credentialKey === "string") return `${label}: ${metadata.credentialKey}`
  const fields = Array.isArray(metadata.changedFields)
    ? metadata.changedFields.filter((field): field is string => typeof field === "string")
    : []
  return fields.length > 0 ? `${label}: ${fields.join(", ")}` : label
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
