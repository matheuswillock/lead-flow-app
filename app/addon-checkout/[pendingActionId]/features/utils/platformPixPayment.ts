import { toPixImageSrc } from "@/components/public-checkout/pixImage"

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type StartedPixPaymentResult = {
  amountInCents: number
  pix?: { brCode: string; brCodeBase64: string; expiresAt: string }
}

export type PlatformPixPaymentData = {
  amount: number
  invoiceUrl: null
  pix: { payload: string; encodedImage: string; expirationDate: string }
}

type StoredKey = { key: string; pixExpiresAt: string | null }
type PlatformPaymentMethod = "PIX" | "CARD"

const STORAGE_PREFIX = "platform-pix-idempotency:"
const PIX_UNAVAILABLE_MESSAGE = "O PIX ainda não está disponível. Tente novamente em instantes."

export function mapStartedPixPaymentToPaymentData(result: StartedPixPaymentResult): PlatformPixPaymentData {
  if (!result.pix) throw new Error(PIX_UNAVAILABLE_MESSAGE)
  return {
    amount: result.amountInCents / 100,
    invoiceUrl: null,
    pix: {
      payload: result.pix.brCode,
      encodedImage: toPixImageSrc(result.pix.brCodeBase64) ?? "",
      expirationDate: result.pix.expiresAt,
    },
  }
}

export function resolvePixIdempotencyKey(
  storage: KeyValueStorage,
  purchaseId: string,
  nowMs: number,
  createId: () => string,
  method: PlatformPaymentMethod = "PIX"
): string {
  const stored = readStoredKey(storage, purchaseId, method)
  if (stored && !isExpired(stored, nowMs)) return stored.key

  const key = `platform-${method.toLowerCase()}:${purchaseId}:${createId()}`
  writeStoredKey(storage, purchaseId, { key, pixExpiresAt: null }, method)
  return key
}

export function rememberPixExpiry(storage: KeyValueStorage, purchaseId: string, expiresAt: string): void {
  const stored = readStoredKey(storage, purchaseId, "PIX")
  if (!stored) return
  writeStoredKey(storage, purchaseId, { ...stored, pixExpiresAt: expiresAt }, "PIX")
}

function isExpired(stored: StoredKey, nowMs: number): boolean {
  if (!stored.pixExpiresAt) return false
  const expiresAtMs = Date.parse(stored.pixExpiresAt)
  return Number.isFinite(expiresAtMs) && nowMs >= expiresAtMs
}

function readStoredKey(storage: KeyValueStorage, purchaseId: string, method: PlatformPaymentMethod): StoredKey | null {
  try {
    const raw = storage.getItem(`${STORAGE_PREFIX}${method.toLowerCase()}:${purchaseId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredKey>
    return typeof parsed.key === "string" ? { key: parsed.key, pixExpiresAt: parsed.pixExpiresAt ?? null } : null
  } catch {
    return null
  }
}

function writeStoredKey(storage: KeyValueStorage, purchaseId: string, value: StoredKey, method: PlatformPaymentMethod): void {
  try {
    storage.setItem(`${STORAGE_PREFIX}${method.toLowerCase()}:${purchaseId}`, JSON.stringify(value))
  } catch {
    // storage indisponível: a chave vale apenas para esta tentativa
  }
}
