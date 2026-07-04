import crypto from "crypto"

export const WHATSAPP_WEBHOOK_HEADER_NAME = "apikey"

export function deriveWebhookHeaderSecret(webhookSecret: string): string {
  const pepper = process.env.WHATSAPP_WEBHOOK_HEADER_SECRET?.trim()
  if (pepper) {
    return crypto.createHmac("sha256", pepper).update(webhookSecret).digest("hex")
  }
  return crypto.createHash("sha256").update(`${webhookSecret}:whatsapp-webhook-header-v1`).digest("hex")
}

export function isWebhookHeaderEnforcementEnabled(): boolean {
  return process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE !== "false"
}

export function readWebhookHeaderSecret(request: { headers: Headers }): string | null {
  return request.headers.get(WHATSAPP_WEBHOOK_HEADER_NAME)?.trim()
    || request.headers.get("x-whatsapp-webhook-secret")?.trim()
    || null
}

export function isValidWebhookHeaderSecret(provided: string | null | undefined, expected: string): boolean {
  if (!provided || !expected) return false
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function extractWebhookSecretFromUrl(webhookUrl: string): string | null {
  return webhookUrl.match(/\/evolution\/([^/?#]+)(?:[/?#]|$)/)?.[1] ?? null
}
