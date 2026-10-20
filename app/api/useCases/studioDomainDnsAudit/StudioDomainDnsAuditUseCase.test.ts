import { describe, expect, it, mock } from "bun:test"
import type { ITeamStudioDomainRepository, TeamStudioDomainRecord } from "@/app/api/infra/data/repositories/teamStudioDomain/ITeamStudioDomainRepository"
import type { IStudioDomainDnsAuditService } from "@/app/api/services/studioDomainDnsAudit/IStudioDomainDnsAuditService"
import type { IStudioDomainDnsNotificationService } from "@/app/api/services/studioDomainDnsAudit/IStudioDomainDnsNotificationService"
import type { StudioDomainDnsAuditResult } from "@/app/api/services/studioDomainDnsAudit/StudioDomainDnsAuditTypes"
import { StudioDomainDnsAuditUseCase } from "./StudioDomainDnsAuditUseCase"

const now = new Date("2026-10-19T12:00:00.000Z")

function makeDomain(id: string, lastDnsNotifiedFingerprint: string | null = null): TeamStudioDomainRecord {
  return {
    id,
    teamId: `team-${id}`,
    hostname: `${id}.example.com`,
    status: "verified",
    vercelDomainId: id,
    verifiedAt: now,
    lastCheckedAt: now,
    dnsAuditStatus: "verified",
    dnsMisconfigured: false,
    dnsReasonCode: "verified",
    dnsReason: "ok",
    recommendedCNAME: null,
    lastDnsAuditAt: now,
    lastDnsAttemptAt: now,
    lastDnsFingerprint: "old-fingerprint",
    lastDnsNotifiedFingerprint,
    createdAt: now,
    updatedAt: now,
  }
}

function makeResult(hostname: string, status: StudioDomainDnsAuditResult["status"], fingerprint: string): StudioDomainDnsAuditResult {
  return {
    hostname,
    status,
    misconfigured: status === "pending",
    recommendedCNAME: status === "pending" ? "target.vercel-dns.com" : null,
    reasonCode: status === "verified" ? "verified" : status === "pending" ? "dns_misconfigured" : status === "failed" ? "domain_not_found" : "project_domain_query_failed",
    reason: status,
    fingerprint,
  }
}

function makeRepository(domains: TeamStudioDomainRecord[]): ITeamStudioDomainRepository {
  return {
    listAll: mock(async () => domains),
    findByTeamId: mock(async () => null),
    findByHostname: mock(async () => null),
    create: mock(async () => domains[0]),
    saveCheckResult: mock(async () => domains[0]),
    saveDnsAuditResult: mock(async () => domains[0]),
    markDnsAuditNotified: mock(async () => domains[0]),
    deleteById: mock(async () => undefined),
  }
}

function makeAuditService(results: Map<string, StudioDomainDnsAuditResult>): IStudioDomainDnsAuditService {
  return { audit: mock(async (hostname: string) => results.get(hostname)!) }
}

function makeNotifier(): IStudioDomainDnsNotificationService {
  return { notify: mock(async () => undefined) }
}

describe("StudioDomainDnsAuditUseCase", () => {
  it("audita todos os domínios verificados", async () => {
    const domains = [makeDomain("one"), makeDomain("two")]
    const repository = makeRepository(domains)
    const useCase = new StudioDomainDnsAuditUseCase({
      repository,
      auditService: makeAuditService(new Map(domains.map((domain) => [domain.hostname, makeResult(domain.hostname, "verified", `fp-${domain.id}`)]))),
    })

    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ total: 2, verified: 2, pending: 0, failed: 0, inconclusive: 0 })
    expect(repository.saveDnsAuditResult).toHaveBeenCalledTimes(2)
  })

  it("persiste inconclusive sem notificar", async () => {
    const domain = makeDomain("inconclusive")
    const repository = makeRepository([domain])
    const notifier = makeNotifier()
    const useCase = new StudioDomainDnsAuditUseCase({
      repository,
      notificationService: notifier,
      auditService: makeAuditService(new Map([[domain.hostname, makeResult(domain.hostname, "inconclusive", "fp-inconclusive")]])),
    })

    const output = await useCase.execute()

    expect(output.result).toMatchObject({ inconclusive: 1, notified: 0 })
    expect(notifier.notify).not.toHaveBeenCalled()
  })

  it("continua o lote quando um domínio falha", async () => {
    const domains = [makeDomain("failed"), makeDomain("verified")]
    const repository = makeRepository(domains)
    const useCase = new StudioDomainDnsAuditUseCase({
      repository,
      auditService: makeAuditService(new Map([
        [domains[0].hostname, makeResult(domains[0].hostname, "failed", "fp-failed")],
        [domains[1].hostname, makeResult(domains[1].hostname, "verified", "fp-verified")],
      ])),
    })

    const output = await useCase.execute()

    expect(output.result).toMatchObject({ total: 2, failed: 1, verified: 1 })
    expect(repository.saveDnsAuditResult).toHaveBeenCalledTimes(2)
  })

  it("notifica fingerprint novo", async () => {
    const domain = makeDomain("new")
    const notifier = makeNotifier()
    const useCase = new StudioDomainDnsAuditUseCase({
      repository: makeRepository([domain]),
      notificationService: notifier,
      auditService: makeAuditService(new Map([[domain.hostname, makeResult(domain.hostname, "pending", "fp-new")]])),
    })

    const output = await useCase.execute()

    expect(output.result).toMatchObject({ notified: 1 })
    expect(notifier.notify).toHaveBeenCalledTimes(1)
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({
      lastCheckedAt: expect.any(Date),
      result: expect.objectContaining({ hostname: domain.hostname }),
    }))
  })

  it("não repete notificação para o mesmo fingerprint", async () => {
    const domain = makeDomain("same", "fp-same")
    const notifier = makeNotifier()
    const useCase = new StudioDomainDnsAuditUseCase({
      repository: makeRepository([domain]),
      notificationService: notifier,
      auditService: makeAuditService(new Map([[domain.hostname, makeResult(domain.hostname, "pending", "fp-same")]])),
    })

    const output = await useCase.execute()

    expect(output.result).toMatchObject({ notified: 0 })
    expect(notifier.notify).not.toHaveBeenCalled()
  })

  it("notifica quando recupera para verified com fingerprint novo", async () => {
    const domain = makeDomain("recovered", "fp-pending")
    const notifier = makeNotifier()
    const useCase = new StudioDomainDnsAuditUseCase({
      repository: makeRepository([domain]),
      notificationService: notifier,
      auditService: makeAuditService(new Map([[domain.hostname, makeResult(domain.hostname, "verified", "fp-verified")]])),
    })

    const output = await useCase.execute()

    expect(output.result).toMatchObject({ verified: 1, notified: 1 })
    expect(notifier.notify).toHaveBeenCalledTimes(1)
  })
})
