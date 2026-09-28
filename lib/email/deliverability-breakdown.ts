export type DeliverabilityLog = {
  senderDomain: string | null
  recipientProvider: string | null
  status: "delivered" | "bounced" | "complained" | "failed" | string
}

export type DeliverabilityBreakdown = {
  key: string
  senderDomain: string | null
  recipientProvider: string | null
  total: number
  delivered: number
  bounced: number
  complained: number
  failed: number
}

export function buildDeliverabilityBreakdown(logs: DeliverabilityLog[]): DeliverabilityBreakdown[] {
  const groups = new Map<string, DeliverabilityBreakdown>()
  for (const log of logs) {
    const senderDomain = log.senderDomain?.trim().toLowerCase() || null
    const recipientProvider = log.recipientProvider?.trim().toLowerCase() || null
    const key = `${senderDomain ?? "unknown"}|${recipientProvider ?? "unknown"}`
    const current = groups.get(key) ?? { key, senderDomain, recipientProvider, total: 0, delivered: 0, bounced: 0, complained: 0, failed: 0 }
    current.total += 1
    if (log.status === "delivered") current.delivered += 1
    if (log.status === "bounced") current.bounced += 1
    if (log.status === "complained") current.complained += 1
    if (log.status === "failed") current.failed += 1
    groups.set(key, current)
  }
  return [...groups.values()].sort((a, b) => b.total - a.total)
}
