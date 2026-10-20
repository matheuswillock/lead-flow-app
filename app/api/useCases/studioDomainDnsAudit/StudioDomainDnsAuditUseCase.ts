import { Output } from "@/lib/output"
import type { ITeamStudioDomainRepository, TeamStudioDomainRecord } from "@/app/api/infra/data/repositories/teamStudioDomain/ITeamStudioDomainRepository"
import { teamStudioDomainRepository } from "@/app/api/infra/data/repositories/teamStudioDomain/TeamStudioDomainRepository"
import type { IStudioDomainDnsAuditService } from "@/app/api/services/studioDomainDnsAudit/IStudioDomainDnsAuditService"
import type { StudioDomainDnsAuditResult } from "@/app/api/services/studioDomainDnsAudit/StudioDomainDnsAuditTypes"
import type { IStudioDomainDnsNotificationService } from "@/app/api/services/studioDomainDnsAudit/IStudioDomainDnsNotificationService"
import { StudioDomainDnsAuditService } from "@/app/api/services/studioDomainDnsAudit/StudioDomainDnsAuditService"
import { studioDomainDnsNotificationService } from "@/app/api/services/studioDomainDnsAudit/StudioDomainDnsNotificationService"
import { vercelDomainsGateway } from "@/app/api/services/vercelDomains/VercelDomainsGateway"
import type { IStudioDomainDnsAuditUseCase, StudioDomainDnsAuditBatchSummary } from "./IStudioDomainDnsAuditUseCase"

export class StudioDomainDnsAuditUseCase implements IStudioDomainDnsAuditUseCase {
  private readonly repository: ITeamStudioDomainRepository
  private readonly auditService: IStudioDomainDnsAuditService
  private readonly notificationService?: IStudioDomainDnsNotificationService

  constructor(input: {
    auditService: IStudioDomainDnsAuditService
    repository?: ITeamStudioDomainRepository
    notificationService?: IStudioDomainDnsNotificationService
  }) {
    this.repository = input.repository ?? teamStudioDomainRepository
    this.auditService = input.auditService
    this.notificationService = input.notificationService
  }

  async execute(): Promise<Output> {
    try {
      const domains = await this.repository.listAll()
      const summary = this.createSummary(domains.length)

      // Sequencialmente evita sobrecarregar a API da Vercel e mantém atualizações previsíveis.
      for (const domain of domains) {
        await this.processDomain(domain, summary)
      }

      return new Output(true, ["Auditoria DNS concluída"], [], summary)
    } catch (error) {
      console.error("[StudioDomainDnsAuditUseCase] Falha ao listar domínios:", error)
      return new Output(false, [], ["Não foi possível iniciar a auditoria DNS"], null)
    }
  }

  private async processDomain(
    domain: TeamStudioDomainRecord,
    summary: StudioDomainDnsAuditBatchSummary,
  ): Promise<void> {
    try {
      const result = await this.auditDomain(domain)
      this.incrementStatus(summary, result.status)
      const lastCheckedAt = new Date()
      await this.repository.saveDnsAuditResult(domain.id, {
        dnsAuditStatus: result.status,
        dnsMisconfigured: result.misconfigured,
        dnsReasonCode: result.reasonCode,
        dnsReason: result.reason,
        recommendedCNAME: result.recommendedCNAME,
        lastDnsAuditAt: lastCheckedAt,
        lastDnsAttemptAt: lastCheckedAt,
        lastDnsFingerprint: result.fingerprint,
      })
      await this.notifyIfNeeded(domain, result, lastCheckedAt, summary)
    } catch (error) {
      summary.errors += 1
      console.error(`[StudioDomainDnsAuditUseCase] Falha no domínio ${domain.hostname}:`, error)
    }
  }

  private async auditDomain(domain: TeamStudioDomainRecord): Promise<StudioDomainDnsAuditResult> {
    try {
      return await this.auditService.audit(domain.hostname)
    } catch {
      return {
        hostname: domain.hostname,
        status: "inconclusive",
        misconfigured: false,
        recommendedCNAME: null,
        reasonCode: "audit_failed",
        reason: "Não foi possível concluir a auditoria DNS.",
        fingerprint: `audit-failed:${domain.hostname}`,
      }
    }
  }

  private async notifyIfNeeded(
    domain: TeamStudioDomainRecord,
    result: StudioDomainDnsAuditResult,
    lastCheckedAt: Date,
    summary: StudioDomainDnsAuditBatchSummary,
  ): Promise<void> {
    if (!this.notificationService || result.status === "inconclusive") return
    if (domain.lastDnsNotifiedFingerprint === result.fingerprint) return

    await this.notificationService.notify({ domainId: domain.id, teamId: domain.teamId, result, lastCheckedAt })
    await this.repository.markDnsAuditNotified(domain.id, { fingerprint: result.fingerprint })
    summary.notified += 1
  }

  private createSummary(total: number): StudioDomainDnsAuditBatchSummary {
    return { total, verified: 0, pending: 0, failed: 0, inconclusive: 0, notified: 0, errors: 0 }
  }

  private incrementStatus(summary: StudioDomainDnsAuditBatchSummary, status: StudioDomainDnsAuditResult["status"]): void {
    summary[status] += 1
  }
}

export const studioDomainDnsAuditUseCase = new StudioDomainDnsAuditUseCase({
  auditService: new StudioDomainDnsAuditService(vercelDomainsGateway),
  notificationService: studioDomainDnsNotificationService,
})
