import { Output } from "@/lib/output"
import { emailDmarcReportService } from "@/app/api/services/emailDmarc/EmailDmarcReportService"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

export class EmailDmarcReportUseCase {
  async register(input: unknown, ctx: TeamAccess): Promise<Output> {
    try { return new Output(true, ["Relatório DMARC registrado"], [], await emailDmarcReportService.register(ctx.teamId, input)) }
    catch (error) { return new Output(false, [], [error instanceof Error ? error.message : "Relatório DMARC inválido"], null) }
  }
}
