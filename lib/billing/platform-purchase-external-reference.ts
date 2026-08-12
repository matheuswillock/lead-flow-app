export const PLATFORM_PURCHASE_EXTERNAL_REFERENCE_PREFIX = "platform-purchase-" as const

export function buildPlatformPurchaseExternalReference(purchaseId: string): string {
  return `${PLATFORM_PURCHASE_EXTERNAL_REFERENCE_PREFIX}${purchaseId}`
}

export function parsePlatformPurchaseExternalReference(
  externalReference: string | null | undefined
): string | null {
  if (!externalReference) return null
  const value = externalReference.trim()
  if (!value.startsWith(PLATFORM_PURCHASE_EXTERNAL_REFERENCE_PREFIX)) return null
  const id = value.slice(PLATFORM_PURCHASE_EXTERNAL_REFERENCE_PREFIX.length).trim()
  return id.length > 0 ? id : null
}
