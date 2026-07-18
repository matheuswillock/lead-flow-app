import { randomUUID } from "node:crypto"
import { BackofficeLeadOrigin, BackofficeLeadStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/BackofficeLeadRepository"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import { backofficeLeadSlackNotificationService } from "@/app/api/services/backofficeLeadSlack/BackofficeLeadSlackNotificationService"
import type {
  CreatePublicBackofficeLeadFormInput,
  IBackofficePublicLeadFormUseCase,
} from "./IBackofficePublicLeadFormUseCase"

function nullIfEmpty(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildSourceExternalId(input: CreatePublicBackofficeLeadFormInput): string | null {
  const email = nullIfEmpty(input.email)?.toLowerCase()
  if (email) return `public_form:${email}`

  const phoneDigits = nullIfEmpty(input.phone)?.replace(/\D/g, "")
  if (phoneDigits) return `public_form:phone:${phoneDigits}`

  return null
}

function buildTrackingNotes(input: CreatePublicBackofficeLeadFormInput): string | null {
  const lines = [
    "Lead criado via formulário público do backoffice.",
    nullIfEmpty(input.notes),
    input.utmSource ? `utm_source: ${input.utmSource}` : null,
    input.utmMedium ? `utm_medium: ${input.utmMedium}` : null,
    input.utmCampaign ? `utm_campaign: ${input.utmCampaign}` : null,
    input.utmContent ? `utm_content: ${input.utmContent}` : null,
    input.utmTerm ? `utm_term: ${input.utmTerm}` : null,
    input.landingUrl ? `landing_url: ${input.landingUrl}` : null,
    input.referrer ? `referrer: ${input.referrer}` : null,
  ].filter((item): item is string => Boolean(item))

  return lines.length > 0 ? lines.join("\n") : null
}

export class BackofficePublicLeadFormUseCase implements IBackofficePublicLeadFormUseCase {
  constructor(private readonly leadRepository: IBackofficeLeadRepository) {}

  async create(input: CreatePublicBackofficeLeadFormInput): Promise<Output> {
    try {
      const name = input.name.trim()
      const email = nullIfEmpty(input.email)
      const phone = nullIfEmpty(input.phone)

      if (!email && !phone) {
        return new Output(false, [], ["Informe e-mail ou telefone."], null)
      }

      const sourceExternalId = buildSourceExternalId(input)
      if (sourceExternalId) {
        const existing = await this.leadRepository.findBySourceExternalId(sourceExternalId)
        if (existing) {
          await backofficeLeadSlackNotificationService.sendLeadCreatedEventBestEffort({
            lead: existing,
            title: "Novo lead via formulário público (lead existente)",
            force: true,
          })

          return new Output(true, ["Lead já existente para este formulário público"], [], {
            id: existing.id,
            duplicated: true,
          })
        }
      }

      const lead = await this.leadRepository.create({
        id: randomUUID(),
        name,
        email,
        phone,
        cpfCnpj: nullIfEmpty(input.cpfCnpj),
        notes: buildTrackingNotes(input),
        status: BackofficeLeadStatus.new_opportunity,
        origin: "public_form" as unknown as BackofficeLeadOrigin,
        sourceExternalId,
        createdByProfileId: null,
        qualificationLeadOrganization: nullIfEmpty(input.qualificationLeadOrganization),
        qualificationAvgUsers: nullIfEmpty(input.qualificationAvgUsers),
        qualificationProfileFit: nullIfEmpty(input.qualificationProfileFit),
      })

      console.info("[BackofficePublicLeadFormUseCase][create] Lead criado com sucesso", {
        id: lead.id,
      })

      await backofficeLeadSlackNotificationService.sendLeadCreatedEventBestEffort({
        lead,
        title: "Novo lead via formulário público",
      })

      return new Output(true, ["Lead criado com sucesso"], [], {
        id: lead.id,
        duplicated: false,
      })
    } catch (error) {
      console.error("[BackofficePublicLeadFormUseCase][create] Erro ao criar lead", error)
      return new Output(false, [], ["Erro ao registrar lead"], null)
    }
  }
}

export const backofficePublicLeadFormUseCase = new BackofficePublicLeadFormUseCase(
  new BackofficeLeadRepository(),
)
