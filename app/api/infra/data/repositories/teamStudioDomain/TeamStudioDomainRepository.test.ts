import { describe, expect, it, mock } from "bun:test"

const update = mock(async (args: unknown) => args)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { teamStudioDomain: { update } },
}))

const { TeamStudioDomainRepository } = await import("./TeamStudioDomainRepository")

describe("TeamStudioDomainRepository DNS audit persistence", () => {
  it("preserves the authoritative DNS result on inconclusive attempts", async () => {
    const repository = new TeamStudioDomainRepository()
    const attemptAt = new Date("2026-10-19T12:00:00.000Z")

    await repository.saveDnsAuditResult("domain-1", {
      dnsAuditStatus: "inconclusive",
      dnsMisconfigured: false,
      lastDnsAttemptAt: attemptAt,
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "domain-1" },
        data: {
          dnsAuditStatus: "inconclusive",
          lastDnsAttemptAt: attemptAt,
        },
      }),
    )
  })

  it("persists authoritative DNS fields for a conclusive result", async () => {
    const repository = new TeamStudioDomainRepository()
    const auditAt = new Date("2026-10-19T12:00:00.000Z")

    await repository.saveDnsAuditResult("domain-1", {
       dnsAuditStatus: "pending",
      dnsMisconfigured: true,
      dnsReasonCode: "CNAME_MISMATCH",
      dnsReason: "CNAME incorreto",
      recommendedCNAME: "target.vercel-dns.com",
      lastDnsAuditAt: auditAt,
      lastDnsAttemptAt: auditAt,
      lastDnsFingerprint: "fingerprint-1",
    })

    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
           dnsAuditStatus: "pending",
          dnsMisconfigured: true,
          dnsReasonCode: "CNAME_MISMATCH",
          dnsReason: "CNAME incorreto",
          recommendedCNAME: "target.vercel-dns.com",
          lastDnsAuditAt: auditAt,
          lastDnsAttemptAt: auditAt,
          lastDnsFingerprint: "fingerprint-1",
        },
      }),
    )
  })
})
