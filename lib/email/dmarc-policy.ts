export type DmarcAggregateReport = {
  domain: string
  passRate: number
  totalMessages: number
  alignedMessages: number
  reportedAt: string
}

export type DmarcOperationalStatus = "pending" | "aligned" | "attention" | "failed"

export function resolveDmarcStatus(report: DmarcAggregateReport | null): DmarcOperationalStatus {
  if (!report) return "pending"
  if (report.totalMessages <= 0) return "attention"
  if (report.passRate >= 0.98) return "aligned"
  if (report.passRate >= 0.9) return "attention"
  return "failed"
}

export function normalizeDmarcReport(input: unknown): DmarcAggregateReport {
  if (!input || typeof input !== "object") throw new Error("Relatório DMARC inválido")
  const value = input as Record<string, unknown>
  const domain = typeof value.domain === "string" ? value.domain.trim().toLowerCase() : ""
  const totalMessages = Number(value.totalMessages)
  const alignedMessages = Number(value.alignedMessages)
  if (!domain || !Number.isFinite(totalMessages) || totalMessages < 0 || !Number.isFinite(alignedMessages) || alignedMessages < 0 || alignedMessages > totalMessages) {
    throw new Error("Relatório DMARC inválido")
  }
  return { domain, totalMessages, alignedMessages, passRate: totalMessages === 0 ? 0 : alignedMessages / totalMessages, reportedAt: typeof value.reportedAt === "string" ? value.reportedAt : new Date().toISOString() }
}
