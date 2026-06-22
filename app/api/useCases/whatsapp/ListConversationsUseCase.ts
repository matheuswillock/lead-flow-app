import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface ListConversationsInput {
  teamId: string
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
      const result = await whatsAppRepository.listConversations(input)
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[ListConversationsUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao listar conversas"
      return new Output(false, [], [message], null)
    }
  }
}

export const listConversationsUseCase = new ListConversationsUseCase()
