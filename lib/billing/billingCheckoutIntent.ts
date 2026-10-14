import { createHash, randomBytes } from "node:crypto"

export function createBillingCheckoutToken(): { token: string; tokenHash: string; tokenPreview: string } {
  const token = randomBytes(32).toString("base64url")
  return {
    token,
    tokenHash: hashBillingCheckoutToken(token),
    tokenPreview: `${token.slice(0, 8)}…`,
  }
}

export function hashBillingCheckoutToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function hashBillingQuote(snapshot: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
}

export function getHostedCheckoutUrl(checkoutId: string): string {
  const host = process.env.ASAAS_ENV === "production" ? "www" : "sandbox"
  return `https://${host}.asaas.com/checkoutSession/show?id=${checkoutId}`
}
