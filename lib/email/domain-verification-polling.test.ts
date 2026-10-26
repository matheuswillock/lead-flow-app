import { describe, expect, it } from "bun:test"
import {
  DOMAIN_VERIFICATION_POLL_TIMEOUT_MS,
  isDomainVerificationPollActive,
  isDomainVerificationTerminal,
  shouldContinueDomainVerificationPolling,
} from "./domain-verification-polling"

describe("isDomainVerificationTerminal", () => {
  it("encerra quando o domínio foi verificado", () => {
    expect(isDomainVerificationTerminal("verified")).toBe(true)
  })

  it("encerra em falha definitiva, mas continua em falha temporária", () => {
    expect(isDomainVerificationTerminal("failed")).toBe(true)
    expect(isDomainVerificationTerminal("partially_failed")).toBe(true)
    expect(isDomainVerificationTerminal("temporary_failure")).toBe(false)
  })

  it("continua enquanto o estado está pendente e o prazo não expirou", () => {
    expect(shouldContinueDomainVerificationPolling("pending", 1_000, 1_001)).toBe(true)
    expect(
      shouldContinueDomainVerificationPolling(
        "pending",
        1_000,
        1_000 + DOMAIN_VERIFICATION_POLL_TIMEOUT_MS,
      ),
    ).toBe(false)
  })
})

describe("isDomainVerificationPollActive", () => {
  it("aceita somente a execução atualmente ativa", () => {
    expect(isDomainVerificationPollActive("poll-2", "poll-2")).toBe(true)
    expect(isDomainVerificationPollActive("poll-1", "poll-2")).toBe(false)
    expect(isDomainVerificationPollActive("poll-2", null)).toBe(false)
  })
})
