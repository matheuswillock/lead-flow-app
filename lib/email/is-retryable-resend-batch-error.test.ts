import { describe, expect, it } from "bun:test"
import {
  isRetryableResendBatchError,
  MAX_BATCH_SEND_ATTEMPTS,
  resendBatchRetryBackoffMs,
} from "@/lib/email/is-retryable-resend-batch-error"

describe("isRetryableResendBatchError", () => {
  it("403 não é retryable", () => {
    expect(isRetryableResendBatchError({ statusCode: 403, message: "domain not verified" })).toBe(
      false,
    )
  })

  it("422 não é retryable", () => {
    expect(isRetryableResendBatchError({ statusCode: 422, message: "validation" })).toBe(false)
  })

  it("429 é retryable", () => {
    expect(isRetryableResendBatchError({ statusCode: 429, message: "rate limit" })).toBe(true)
  })

  it("5xx é retryable", () => {
    expect(isRetryableResendBatchError({ statusCode: 503, message: "unavailable" })).toBe(true)
  })

  it("409 idempotency é retryable com nova chave", () => {
    expect(
      isRetryableResendBatchError({ statusCode: 409, message: "idempotency key conflict" }),
    ).toBe(true)
  })
})

describe("resendBatchRetryBackoffMs", () => {
  it("backoff progressivo", () => {
    expect(resendBatchRetryBackoffMs(0)).toBe(0)
    expect(resendBatchRetryBackoffMs(1)).toBe(2000)
    expect(resendBatchRetryBackoffMs(2)).toBe(5000)
  })

  it("MAX_BATCH_SEND_ATTEMPTS = 3", () => {
    expect(MAX_BATCH_SEND_ATTEMPTS).toBe(3)
  })
})
