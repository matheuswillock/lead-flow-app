import { normalizeDmarcReport, resolveDmarcStatus } from "@/lib/email/dmarc-policy"
import { emailDmarcReportRepository } from "@/app/api/infra/data/repositories/emailDmarc/EmailDmarcReportRepository"

export class EmailDmarcReportService {
  async register(teamId: string, input: unknown) {
    const report = normalizeDmarcReport(input)
    const status = resolveDmarcStatus(report)
    await emailDmarcReportRepository.register(teamId, status, report)
    return { status, report }
  }
}

export const emailDmarcReportService = new EmailDmarcReportService()
