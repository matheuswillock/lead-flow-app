import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { buildConversationVisibilityWhere } from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface GetUnreadCountInput {
  teamId: string
  access: TeamAccess
}

class GetWhatsAppUnreadCountUseCase {
  async execute(input: GetUnreadCountInput): Promise<Output> {
    try {
      const visibilityWhere = await buildConversationVisibilityWhere(input.access)
      const totals = await whatsAppRepository.getUnreadTotals({
        teamId: input.teamId,
        visibilityWhere,
      })

      return new Output(true, [], [], {
        totalUnreadMessages: totals.totalMessages,
        totalUnreadConversations: totals.totalConversations,
      })
    } catch (error) {
      console.error("[GetWhatsAppUnreadCountUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao contar mensagens não lidas"
      return new Output(false, [], [message], null)
    }
  }
}

export const getWhatsAppUnreadCountUseCase = new GetWhatsAppUnreadCountUseCase()
