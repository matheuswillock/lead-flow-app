import { Output } from "@/lib/output"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import type { IEmailLogRepository } from "@/app/api/infra/data/repositories/emailLog/IEmailLogRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import type { IPublicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import { resolveAttributionDisplayName } from "@/lib/public-forms/email-campaign-attribution"
import { isValidPublicFormId } from "@/lib/public-forms/validation"

export type PublicFormPrefillResult = {
  name: string | null
  email: string | null
}

class ResolvePublicFormPrefillUseCase {
  constructor(
    private readonly formsRepository: Pick<IPublicFormsRepository, "findTeamIdByPublicId">,
    private readonly logsRepository: Pick<IEmailLogRepository, "findCampaignLogForAttribution">,
  ) {}

  async execute(publicId: string, emailLogId: string): Promise<Output> {
    if (!isValidPublicFormId(publicId) || !emailLogId?.trim()) {
      return new Output(false, [], ["Parâmetros inválidos"], null)
    }

    const teamId = await this.formsRepository.findTeamIdByPublicId(publicId)
    if (!teamId) {
      return new Output(false, [], ["Formulário não encontrado"], null)
    }

    const log = await this.logsRepository.findCampaignLogForAttribution(teamId, emailLogId)
    if (!log) {
      return new Output(false, [], ["Token de campanha inválido"], null)
    }

    const result: PublicFormPrefillResult = {
      name: resolveAttributionDisplayName(log.recipientName, log.recipientEmail) || null,
      email: log.recipientEmail.trim().toLowerCase() || null,
    }

    return new Output(true, [], [], result)
  }
}

export const resolvePublicFormPrefillUseCase = new ResolvePublicFormPrefillUseCase(
  publicFormsRepository,
  emailLogRepository,
)
