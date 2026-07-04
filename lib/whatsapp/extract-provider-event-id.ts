export type ExtractProviderEventIdOptions = {
  /** Quando data é array, o id do envelope é compartilhado — usar id por mensagem. */
  skipEnvelopeId?: boolean
}

export function extractProviderEventId(
  rawEvent: unknown,
  eventType: string,
  providerMessageId: string,
  options?: ExtractProviderEventIdOptions
): string | undefined {
  if (typeof rawEvent !== "object" || rawEvent === null) return undefined
  const record = rawEvent as Record<string, unknown>
  if (!options?.skipEnvelopeId) {
    for (const key of ["id", "eventId", "hash"] as const) {
      const value = record[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
  }
  const normalizedEventType = eventType.trim().toUpperCase()
  const normalizedMessageId = providerMessageId.trim()
  if (!normalizedEventType || !normalizedMessageId) return undefined
  const instance = typeof record["instance"] === "string" ? record["instance"].trim() : ""
  const dateTime =
    typeof record["date_time"] === "string" ? record["date_time"].trim()
    : typeof record["dateTime"] === "string" ? record["dateTime"].trim() : ""
  if (instance && dateTime) {
    return `${instance}:${dateTime}:${normalizedEventType}:${normalizedMessageId}`
  }
  return `${normalizedEventType}:${normalizedMessageId}`
}
