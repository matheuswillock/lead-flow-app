import { Output } from "@/lib/output"
import type { IWhatsAppService, CreateWhatsAppConfigInput } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import { teamHasWhatsAppFeature } from "@/lib/whatsapp/team-has-whatsapp-feature"
import { isManagerLikeRole } from "@/lib/roles"

interface CreateWhatsAppConfigUseCaseInput extends CreateWhatsAppConfigInput {
  callerIsMaster: boolean
  callerRole: string
}

class CreateWhatsAppConfigUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  private assertManagerAccess(input: CreateWhatsAppConfigUseCaseInput): Output | null {
    if (input.callerIsMaster || isManagerLikeRole(input.callerRole)) {
      return null
    }
    return new Output(false, [], ["Apenas gestores podem provisionar o WhatsApp"], null)
  }

  private async assertWhatsAppAddon(teamId: string): Promise<Output | null> {
    const hasFeature = await teamHasWhatsAppFeature(teamId)
    if (!hasFeature) {
      return new Output(false, [], ["Addon WhatsApp não está ativo para este time"], null)
    }
    return null
  }

  async execute(input: CreateWhatsAppConfigUseCaseInput): Promise<Output> {
    try {
      const managerDenied = this.assertManagerAccess(input)
      if (managerDenied) return managerDenied

      const addonDenied = await this.assertWhatsAppAddon(input.teamId)
      if (addonDenied) return addonDenied

      const result = await this.service.createConfig({
        teamId: input.teamId,
        profileId: input.profileId,
        usageLimitMonthly: input.usageLimitMonthly,
        reuseFromTeamId: input.reuseFromTeamId,
        callerIsMaster: input.callerIsMaster,
      })
      return new Output(true, ["Configuração criada com sucesso"], [], result)
    } catch (error) {
      console.error("[CreateWhatsAppConfigUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao criar configuração do WhatsApp"
      return new Output(false, [], [message], null)
    }
  }
}

export const createWhatsAppConfigUseCase = new CreateWhatsAppConfigUseCase(whatsAppService)
