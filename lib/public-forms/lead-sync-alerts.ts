import type { Lead } from "@prisma/client"
import {
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  type ExtractedLeadData,
} from "./lead-identity"

export function buildLeadIdentityAlerts(extracted: ExtractedLeadData): string[] {
  const alerts: string[] = []
  if (!extracted.name.trim()) alerts.push("Nome ausente")
  if (!extracted.email.trim()) alerts.push("E-mail ausente")
  if (!extracted.normalizedPhone) alerts.push("Telefone ausente")
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
    alerts.push("Não foi possível criar o lead: informe nome e telefone")
  }

  return alerts
}

export function formatLeadSyncAlerts(alerts: string[]): string | undefined {
  const unique = [...new Set(alerts.map((alert) => alert.trim()).filter(Boolean))]
  if (unique.length === 0) return undefined
  return unique.join("; ")
}
