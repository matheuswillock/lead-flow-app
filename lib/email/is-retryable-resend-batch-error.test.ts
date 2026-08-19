import { describe, expect, it } from "bun:test"
import {
  isResendMonthlyQuotaExceeded,
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

  it("429 de rate limit é retryable", () => {
    expect(
      isRetryableResendBatchError({
        statusCode: 429,
        name: "rate_limit_exceeded",
        message: "Too many requests",
      })
    ).toBe(true)
  })

  it("429 de cota mensal não é retryable", () => {
    expect(
      isRetryableResendBatchError({
        statusCode: 429,
        name: "monthly_quota_exceeded",
        message: "You have exceeded your monthly email sending quota.",
      })
    ).toBe(false)
  })

  it("isResendMonthlyQuotaExceeded reconhece name e mensagem", () => {
    expect(
      isResendMonthlyQuotaExceeded({
        statusCode: 429,
        name: "monthly_quota_exceeded",
        message: "You have exceeded your monthly email sending quota.",
      })
    ).toBe(true)
    expect(
      isResendMonthlyQuotaExceeded({
        statusCode: 429,
        name: "rate_limit_exceeded",
        message: "Too many requests",
      })
    ).toBe(false)
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
