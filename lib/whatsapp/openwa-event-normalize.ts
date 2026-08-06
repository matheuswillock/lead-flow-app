export type NormalizedOpenWaEvent =
  | { kind: "qr"; instance: string; qr: string }
  | { kind: "ready"; instance: string }
  | { kind: "disconnected"; instance: string; reason?: string }
  | {
      kind: "message"
      instance: string
      providerMessageId: string
      remoteJid: string
      body: string | null
      fromMe: boolean
      timestamp: Date
      pushName: string | null
      hasMedia: boolean
      mediaBase64: string | null
      mediaMimeType: string | null
      mediaFileName: string | null
      raw: Record<string, unknown>
    }
  | { kind: "message_ack"; instance: string; providerMessageId: string; ack: number }
  | { kind: "invalid"; reason: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) return value as Record<string, unknown>
  return null
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null
  const value = record[key]
  return typeof value === "string" ? value : null
}

export function normalizeOpenWaWebhookEvent(payload: unknown): NormalizedOpenWaEvent {
  const root = asRecord(payload)
  if (!root) return { kind: "invalid", reason: "payload_not_object" }

  const instance = readString(root, "instance") ?? ""
  const event = readString(root, "event")?.toLowerCase() ?? ""
  const data = asRecord(root["data"]) ?? {}

  switch (event) {
    case "qr": {
      const qr = readString(data, "qr") ?? ""
      if (!qr) return { kind: "invalid", reason: "qr_missing" }
      return { kind: "qr", instance, qr }
    }
    case "ready":
      return { kind: "ready", instance }
    case "disconnected":
      return {
        kind: "disconnected",
        instance,
        reason: readString(data, "reason") ?? undefined,
      }
    case "message": {
      const idObj = asRecord(data["id"])
      const providerMessageId =
        readString(idObj, "_serialized") ??
        readString(data, "id") ??
        ""
      const remoteJid = readString(data, "from") ?? readString(data, "to") ?? ""
      if (!providerMessageId || !remoteJid) {
        return { kind: "invalid", reason: "message_missing_ids" }
      }
      const tsRaw = data["timestamp"]
      const timestamp =
        typeof tsRaw === "number"
          ? new Date(tsRaw * (tsRaw < 1e12 ? 1000 : 1))
          : new Date()
      return {
        kind: "message",
        instance,
        providerMessageId,
        remoteJid,
        body: readString(data, "body"),
        fromMe: Boolean(data["fromMe"]),
        timestamp,
        pushName: readString(data, "notifyName") ?? readString(data, "pushName"),
        hasMedia: Boolean(data["hasMedia"]),
        mediaBase64: readString(data, "body") && data["hasMedia"] ? readString(data, "mediaBase64") : readString(data, "mediaBase64"),
        mediaMimeType: readString(data, "mimetype") ?? readString(data, "mediaMimeType"),
        mediaFileName: readString(data, "filename") ?? readString(data, "mediaFileName"),
        raw: data,
      }
    }
    case "message_ack": {
      const providerMessageId = readString(data, "id") ?? ""
      const ack = typeof data["ack"] === "number" ? data["ack"] : -1
      if (!providerMessageId) return { kind: "invalid", reason: "ack_missing_id" }
      return { kind: "message_ack", instance, providerMessageId, ack }
    }
    default:
      return { kind: "invalid", reason: `unknown_event:${event || "empty"}` }
  }
}
