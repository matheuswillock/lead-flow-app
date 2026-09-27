import { prisma } from "@/app/api/infra/data/prisma"
import type { DmarcAggregateReport, DmarcOperationalStatus } from "@/lib/email/dmarc-policy"

export class EmailDmarcReportRepository {
  async register(teamId: string, status: DmarcOperationalStatus, report: DmarcAggregateReport): Promise<void> {
    const settings = await prisma.emailTeamSettings.findUnique({ where: { teamId }, select: { resendDomainName: true, sendingHealthMetrics: true } })
    if (settings?.resendDomainName && settings.resendDomainName !== report.domain) throw new Error("O relatório DMARC não corresponde ao domínio configurado")
    const metrics = settings?.sendingHealthMetrics && typeof settings.sendingHealthMetrics === "object" && !Array.isArray(settings.sendingHealthMetrics) ? settings.sendingHealthMetrics as Record<string, unknown> : {}
    await prisma.emailTeamSettings.upsert({ where: { teamId }, create: { teamId, sendingHealthMetrics: { ...metrics, dmarc: { status, report } } }, update: { sendingHealthMetrics: { ...metrics, dmarc: { status, report } } } })
  }
}

export const emailDmarcReportRepository = new EmailDmarcReportRepository()
