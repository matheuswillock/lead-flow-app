import type { WhatsAppConnectionStatus } from "@prisma/client"

/** Evolution returns base64 with or without a data-URL prefix. */
export function toQrCodeImageUrl(base64OrDataUrl: string): string {
  let trimmed = base64OrDataUrl.trim()
  const duplicatePrefix = "data:image/png;base64,data:"
  if (trimmed.startsWith(duplicatePrefix)) {
    trimmed = trimmed.slice("data:image/png;base64,".length)
  }
  if (trimmed.startsWith("data:")) {
    return trimmed
  }
  return `data:image/png;base64,${trimmed}`
}

export function resolveConfigStatusFromEvo(
  evoStatus: "open" | "connecting" | "close",
  hasQrImage: boolean
): WhatsAppConnectionStatus {
  if (hasQrImage || evoStatus === "connecting") return "QR_READY"
  if (evoStatus === "open") return "CONNECTED"
  return "PENDING"
}
