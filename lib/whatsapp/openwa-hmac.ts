import { createHmac, timingSafeEqual } from "node:crypto"

const SIGNATURE_PREFIX = "sha256="

export function verifyOpenWaHmac(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false

  const provided = signatureHeader.startsWith(SIGNATURE_PREFIX)
    ? signatureHeader.slice(SIGNATURE_PREFIX.length)
    : signatureHeader

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")

  try {
    const a = Buffer.from(provided, "hex")
    const b = Buffer.from(expected, "hex")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
