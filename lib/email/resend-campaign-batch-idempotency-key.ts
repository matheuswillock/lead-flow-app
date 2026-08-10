import { createHash } from "node:crypto"

import { buildResendBatchIdempotencyKey } from "@/lib/email"

/** Normaliza e-mails do lote para identidade estável (ordem + casing). */
export function normalizeCampaignBatchRecipientEmails(emails: readonly string[]): string[] {
  return Array.from(
    new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))
  ).sort()
}

/** Digest curto do conteúdo do lote — mesma composição → mesma chave. */
export function buildCampaignBatchRecipientContentDigest(emails: readonly string[]): string {
  const normalized = normalizeCampaignBatchRecipientEmails(emails)
  return createHash("sha256").update(normalized.join("\n")).digest("hex").slice(0, 16)
}

/** D13 Opção B: idempotency key derivada do conteúdo do lote, não da posição. */
export function buildResendCampaignBatchContentIdempotencyKey(
  dispatchId: string,
  recipientEmails: readonly string[]
): string {
  const digest = buildCampaignBatchRecipientContentDigest(recipientEmails)
  return buildResendBatchIdempotencyKey("campaign", `${dispatchId}/${digest}`)
}

/** Chave legada posicional — só para testes/documentação do bug E4. */
export function buildLegacyPositionalCampaignBatchIdempotencyKey(
  dispatchId: string,
  chunkIndex: number
): string {
  return buildResendBatchIdempotencyKey("campaign", `${dispatchId}/${chunkIndex}`)
}
