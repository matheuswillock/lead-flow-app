import { describe, expect, test } from "bun:test";
import { decryptBethaniaAiProposalParameters, encryptBethaniaAiProposalParameters } from "./cipher";
import { isBethaniaAiUserEligible, mayCallBethaniaAi, type BethaniaAiConfiguration } from "./config";
import { isBethaniaAiProposalConfirmable, bethaniaAiProposalExpiry } from "./proposals";
import { redactBethaniaAiTelemetry } from "./redaction";

const config: BethaniaAiConfiguration = {
  enabled: true, shadowMode: true, rolloutPercentage: 100, dailyUserLimit: 2,
  dailyGlobalLimit: 5, timeoutMs: 8000, circuitBreakerFailureThreshold: 5,
  circuitBreakerResetSeconds: 60, primaryModel: "primary", fallbackModel: "fallback",
};

describe("Bethânia AI safety gates", () => {
  test("rollout is deterministic and honors its boundaries", () => {
    expect(isBethaniaAiUserEligible("link-1", 0)).toBeFalse();
    expect(isBethaniaAiUserEligible("link-1", 100)).toBeTrue();
    expect(isBethaniaAiUserEligible("link-1", 25)).toBe(isBethaniaAiUserEligible("link-1", 25));
    const sampleSize = 20_000;
    const eligibleAt25 = Array.from({ length: sampleSize }, (_, index) =>
      isBethaniaAiUserEligible(`link-${index}`, 25)
    ).filter(Boolean).length;
    // A uniform 32-bit bucket converges to the configured percentage. The
    // previous 8-bit modulo implementation converged to 29.3% here.
    expect(eligibleAt25 / sampleSize).toBeGreaterThan(0.23);
    expect(eligibleAt25 / sampleSize).toBeLessThan(0.27);
  });

  test("never calls a provider while disabled, quota exhausted or circuit open", () => {
    expect(mayCallBethaniaAi({ ...config, enabled: false }, "link", { userRequests: 0, globalRequests: 0 }, false)).toBeFalse();
    expect(mayCallBethaniaAi(config, "link", { userRequests: 2, globalRequests: 0 }, false)).toBeFalse();
    expect(mayCallBethaniaAi(config, "link", { userRequests: 0, globalRequests: 0 }, true)).toBeFalse();
    expect(mayCallBethaniaAi(config, "link", { userRequests: 0, globalRequests: 0 }, false)).toBeTrue();
  });

  test("redacts PII before telemetry", () => {
    const value = redactBethaniaAiTelemetry("CPF 123.456.789-09, ana@example.com, +55 11 99999-9999");
    expect(value).not.toContain("123.456.789-09");
    expect(value).not.toContain("ana@example.com");
    expect(value).not.toContain("99999");
  });

  test("proposal data is encrypted and expires in ten minutes", () => {
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    const cipher = encryptBethaniaAiProposalParameters({ content: "nota privada" });
    expect(cipher).not.toContain("nota privada");
    expect(decryptBethaniaAiProposalParameters<{ content: string }>(cipher)).toEqual({ content: "nota privada" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(bethaniaAiProposalExpiry(now).toISOString()).toBe("2026-01-01T00:10:00.000Z");
    expect(isBethaniaAiProposalConfirmable({ status: "pending", expiresAt: bethaniaAiProposalExpiry(now) }, now)).toBeTrue();
    process.env.ENCRYPTION_KEY = previousKey;
  });
});
