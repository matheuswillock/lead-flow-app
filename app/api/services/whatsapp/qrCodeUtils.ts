import type { WhatsAppConnectionStatus } from "@prisma/client"

/** QR payloads may include a data-URL prefix or raw base64. */
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

/** Provider connection state → TeamWhatsAppConfig status. */
export function resolveConfigStatusFromProvider(
  providerStatus: "open" | "connecting" | "close",
  hasQrImage: boolean
): WhatsAppConnectionStatus {
  if (hasQrImage) return "QR_READY"
  if (providerStatus === "connecting") return "INITIALIZING"
  if (providerStatus === "open") return "CONNECTED"
  return "PENDING"
}

/** @deprecated Use resolveConfigStatusFromProvider */
export const resolveConfigStatusFromEvo = resolveConfigStatusFromProvider
