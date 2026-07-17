import { BackofficeLeadOrigin, type BackofficeLead } from "@prisma/client"
import { Output } from "@/lib/output"
import { detectSqlInjection } from "@/app/api/v1/utils/inputSecurity"
import { backofficeLeadUseCase } from "@/app/api/useCases/backofficeLead/BackofficeLeadUseCase"
import { backofficeEmailCampaignUseCase } from "@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUseCase"
import type { IBackofficeLeadQuickEntryUseCase } from "./IBackofficeLeadQuickEntryUseCase"
import type { BackofficeLeadQuickEntryRequest } from "./DTO/requestBackofficeLeadQuickEntry"

export class BackofficeLeadQuickEntryUseCase implements IBackofficeLeadQuickEntryUseCase {
  async submit(data: BackofficeLeadQuickEntryRequest, createdByProfileId: string): Promise<Output> {
    const textFields = [data.name, data.email ?? "", data.phone ?? "", data.notes ?? ""]
    for (const field of textFields) {
      if (field && detectSqlInjection(field).suspicious) {
        console.warn("[BackofficeLeadQuickEntryUseCase] Entrada suspeita detectada")
        return new Output(false, [], ["Dados inválidos para submissão"], null)
      }
    }

    const leadOutput = await backofficeLeadUseCase.createLead(
      {
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        notes: data.notes ?? null,
        origin: BackofficeLeadOrigin.manual,
      },
      createdByProfileId
    )

    if (!leadOutput.isValid) {
      return leadOutput
    }

    if (data.subscribeToLiveCampaign) {
      const lead = leadOutput.result as BackofficeLead
      try {
        await backofficeEmailCampaignUseCase.subscribeFromLead({
          id: lead.id,
          email: lead.email,
          name: lead.name,
        })
      } catch (error) {
        // Fail-soft: a falha na inscrição na campanha não deve invalidar a criação do lead.
        console.error("[BackofficeLeadQuickEntryUseCase][subscribeToLiveCampaign]", error)
      }
    }

    return new Output(true, ["Lead cadastrado com sucesso"], [], leadOutput.result)
  }
}

export const backofficeLeadQuickEntryUseCase = new BackofficeLeadQuickEntryUseCase()
