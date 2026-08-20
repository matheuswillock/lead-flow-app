import type { Lead } from "@prisma/client"
import {
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  type ExtractedLeadData,
} from "./lead-identity"

export function buildLeadIdentityAlerts(extracted: ExtractedLeadData): string[] {
  const alerts: string[] = []
  if (!extracted.name.trim()) alerts.push("Nome ausente")
  const hasPhone = Boolean(extracted.normalizedPhone)
  const hasEmail = Boolean(extracted.email.trim())
  if (!hasEmail && !hasPhone) {
    alerts.push("E-mail ausente")
  } else if (!hasEmail && hasPhone) {
    alerts.push("E-mail não informado (lead criado com telefone)")
  }
  if (!hasPhone) alerts.push("Telefone ausente")
  return alerts
}

export function buildLeadSyncAlerts(
  extracted: ExtractedLeadData,
  match: Lead | undefined,
): string[] {
  const alerts = buildLeadIdentityAlerts(extracted)

  if (match) {
    if (!canUpdateLeadFromExtracted(extracted)) {
      alerts.push("Não foi possível atualizar o lead: informe telefone ou e-mail")
    }
    return alerts
  }

  if (!canCreateLeadFromExtracted(extracted)) {
    alerts.push(
      "Não foi possível criar o lead: informe nome completo e telefone (celular ou fixo), ou nome, celular e e-mail",
    )
  }

  return alerts
}

export function formatLeadSyncAlerts(alerts: string[]): string | undefined {
  const unique = [...new Set(alerts.map((alert) => alert.trim()).filter(Boolean))]
  if (unique.length === 0) return undefined
  return unique.join("; ")
}
