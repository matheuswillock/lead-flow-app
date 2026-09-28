import { prisma } from "@/app/api/infra/data/prisma"
import type { DmarcAggregateReport, DmarcOperationalStatus } from "@/lib/email/dmarc-policy"

export class EmailDmarcReportRepository {
  async getStatus(teamId: string, domain: string | null): Promise<DmarcOperationalStatus | null> {
    if (!domain) return null
    try {
      const state = await prisma.emailDmarcDomainState.findUnique({
        where: { teamId_domain: { teamId, domain: domain.trim().toLowerCase() } },
        select: { status: true },
      })
      return state?.status ?? null
    } catch (error) {
      if (!isMissingTableError(error)) throw error
      return null
    }
  }
  async register(teamId: string, status: DmarcOperationalStatus, report: DmarcAggregateReport): Promise<void> {
    const settings = await prisma.emailTeamSettings.findUnique({ where: { teamId }, select: { resendDomainName: true, sendingHealthMetrics: true } })
    if (settings?.resendDomainName && settings.resendDomainName !== report.domain) throw new Error("O relatório DMARC não corresponde ao domínio configurado")
    const domain = report.domain.trim().toLowerCase()
    try {
      await prisma.emailDmarcDomainState.upsert({
        where: { teamId_domain: { teamId, domain } },
        create: {
          teamId,
          domain,
          status,
          publishedPolicy: null,
          diagnostic: buildDiagnostic(report),
          lastCheckedAt: new Date(report.reportedAt),
        },
        update: {
          status,
          diagnostic: buildDiagnostic(report),
          lastCheckedAt: new Date(report.reportedAt),
        },
      })
    } catch (error) {
      if (!isMissingTableError(error)) throw error
      const metrics = settings?.sendingHealthMetrics && typeof settings.sendingHealthMetrics === "object" && !Array.isArray(settings.sendingHealthMetrics) ? settings.sendingHealthMetrics as Record<string, unknown> : {}
      await prisma.emailTeamSettings.upsert({ where: { teamId }, create: { teamId, sendingHealthMetrics: { ...metrics, dmarc: { status, report } } }, update: { sendingHealthMetrics: { ...metrics, dmarc: { status, report } } } })
    }
  }
}

function buildDiagnostic(report: DmarcAggregateReport): string {
  return `${report.alignedMessages} de ${report.totalMessages} mensagens alinhadas (${(report.passRate * 100).toFixed(2)}%).`
}

function isMissingTableError(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "P2021"
}

export const emailDmarcReportRepository = new EmailDmarcReportRepository()
