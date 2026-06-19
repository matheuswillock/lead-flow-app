import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface LinkConversationToLeadInput {
  conversationId: string
  leadId: string
}

class LinkConversationToLeadUseCase {
  async execute(input: LinkConversationToLeadInput): Promise<Output> {
    try {
      const conversation = await whatsAppRepository.linkConversationToLead(
        input.conversationId,
        input.leadId
      )
      return new Output(true, ["Conversa vinculada ao lead com sucesso"], [], conversation)
    } catch (error) {
      console.error("[LinkConversationToLeadUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao vincular conversa ao lead"
      return new Output(false, [], [message], null)
    }
  }
}

export const linkConversationToLeadUseCase = new LinkConversationToLeadUseCase()
