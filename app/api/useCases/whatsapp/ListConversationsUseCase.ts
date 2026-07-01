import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { buildConversationVisibilityWhere, resolveVisibilityScope } from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface ListConversationsInput {
  teamId: string
  access: TeamAccess
  leadId?: string
  assignedProfileId?: string
  hasUnread?: boolean
  isArchived?: boolean
  search?: string
  page?: number
  limit?: number
}

class ListConversationsUseCase {
  async execute(input: ListConversationsInput): Promise<Output> {
    try {
      const scope = resolveVisibilityScope(input.access)
      const assignedProfileId =
        scope !== "operator" && input.assignedProfileId
          ? input.assignedProfileId
          : undefined

      const visibilityWhere = await buildConversationVisibilityWhere(input.access)

      const result = await whatsAppRepository.listConversations({
        teamId: input.teamId,
        leadId: input.leadId,
        assignedProfileId,
        hasUnread: input.hasUnread,
        isArchived: input.isArchived,
        search: input.search,
        page: input.page,
        limit: input.limit,
        visibilityWhere,
      })
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[ListConversationsUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao listar conversas"
      return new Output(false, [], [message], null)
    }
  }
}

export const listConversationsUseCase = new ListConversationsUseCase()
