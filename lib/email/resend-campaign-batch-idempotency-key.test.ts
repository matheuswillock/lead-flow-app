import { describe, expect, it } from "bun:test"

import {
  buildCampaignBatchRecipientContentDigest,
  buildLegacyPositionalCampaignBatchIdempotencyKey,
  buildResendCampaignBatchContentIdempotencyKey,
  normalizeCampaignBatchRecipientEmails,
} from "./resend-campaign-batch-idempotency-key"

describe("D13 — idempotency key por conteúdo do lote (E4)", () => {
  const dispatchId = "dispatch-uuid-maternidade"

  it("normaliza ordem e casing dos e-mails", () => {
    expect(normalizeCampaignBatchRecipientEmails(["B@test.com", "a@test.com", "A@test.com"])).toEqual([
      "a@test.com",
      "b@test.com",
    ])
  })

  it("legacy posicional: chunkIndex 0 colide entre tentativa original e retomada (bug E4)", () => {
    const originalFirstChunk = buildLegacyPositionalCampaignBatchIdempotencyKey(dispatchId, 0)
    const resumeFirstChunk = buildLegacyPositionalCampaignBatchIdempotencyKey(dispatchId, 0)

    expect(originalFirstChunk).toBe(resumeFirstChunk)
    expect(originalFirstChunk).toBe(`batch-campaign/${dispatchId}/0`)
  })

  it("content hash: retomada com subconjunto queued gera chave distinta da tentativa original", () => {
    const originalKey = buildResendCampaignBatchContentIdempotencyKey(dispatchId, [
      "alice@test.com",
      "bob@test.com",
      "carol@test.com",
    ])
    const resumeKey = buildResendCampaignBatchContentIdempotencyKey(dispatchId, [
      "bob@test.com",
      "carol@test.com",
    ])

    expect(resumeKey).not.toBe(originalKey)
  })

  it("content hash: mesma composição reutiliza a mesma chave (retry seguro)", () => {
    const emails = ["bob@test.com", "carol@test.com"]
    const first = buildResendCampaignBatchContentIdempotencyKey(dispatchId, emails)
    const second = buildResendCampaignBatchContentIdempotencyKey(dispatchId, [...emails].reverse())

    expect(first).toBe(second)
    expect(buildCampaignBatchRecipientContentDigest(emails)).toHaveLength(16)
  })

  it("content hash: composições diferentes geram digests diferentes", () => {
    const digestA = buildCampaignBatchRecipientContentDigest(["a@test.com", "b@test.com"])
    const digestB = buildCampaignBatchRecipientContentDigest(["a@test.com", "c@test.com"])

    expect(digestA).not.toBe(digestB)
  })
})
