import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

export interface ReusableWhatsAppNumberItem {
  teamId: string
  teamName: string
  phoneNumber: string
  configId: string
}

interface ListReusableWhatsAppNumbersInput {
  teamId: string
  callerIsMaster: boolean
}

class ListReusableWhatsAppNumbersUseCase {
  async execute(input: ListReusableWhatsAppNumbersInput): Promise<Output> {
    try {
      if (!input.callerIsMaster) {
        return new Output(false, [], ["Apenas o master da conta pode reutilizar números"], null)
      }

      const team = await whatsAppRepository.findTeamMasterContext(input.teamId)
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null)
      }

      const configs = await whatsAppRepository.listConnectedConfigsForMaster(team.masterId)
      const items: ReusableWhatsAppNumberItem[] = configs
        .filter((config) => config.teamId !== input.teamId && config.phoneNumber)
        .map((config) => ({
          teamId: config.teamId,
          teamName: config.teamName,
          phoneNumber: config.phoneNumber!,
          configId: config.id,
        }))

      return new Output(true, [], [], items)
    } catch (error) {
      console.error("[ListReusableWhatsAppNumbersUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao listar números reutilizáveis"
      return new Output(false, [], [message], null)
    }
  }
}

export const listReusableWhatsAppNumbersUseCase = new ListReusableWhatsAppNumbersUseCase()
