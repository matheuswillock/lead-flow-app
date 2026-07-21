import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
import { whatsAppLeadActivityService } from "@/app/api/services/whatsapp/WhatsAppLeadActivityService"
import {
  resolveContactNameUpdate,
  type ContactNameSource,
} from "@/lib/whatsapp/contact-name"

interface LinkConversationToLeadInput {
  conversationId: string
  leadId: string
  access: TeamAccess
}

class LinkConversationToLeadUseCase {
  async execute(input: LinkConversationToLeadInput): Promise<Output> {
    try {
      const conversation = await assertCanAccessConversation(input.access, input.conversationId)

      const lead = await leadRepository.findById(input.leadId)
      if (!lead || lead.teamId !== conversation.teamId) {
        return new Output(false, [], ["Lead não encontrado neste time"], null)
      }

      const updatedConversation = await whatsAppRepository.linkConversationToLead(
        input.conversationId,
        input.leadId
      )

      const nameUpdate = resolveContactNameUpdate({
        currentName: conversation.contactName,
        currentSource: conversation.contactNameSource as ContactNameSource,
        incomingName: lead.name,
        incomingSource: "LEAD",
      })

      const finalConversation = nameUpdate
        ? await whatsAppRepository.updateConversation(input.conversationId, nameUpdate)
        : updatedConversation

      try {
        await whatsAppLeadActivityService.recordConversationMilestone({
          teamId: conversation.teamId,
          leadId: input.leadId,
          conversationId: input.conversationId,
          milestone: "conversation_started",
          preview: finalConversation.lastMessagePreview,
        })
      } catch (activityError) {
        console.error("[LinkConversationToLeadUseCase][execute] Falha ao registrar atividade", activityError)
      }

      await whatsAppRepository.createAuditEvent({
        teamId: conversation.teamId,
        conversationId: input.conversationId,
        actorProfileId: input.access.profileId,
        action: "conversation.link_lead",
        metadata: { leadId: input.leadId },
      })

      return new Output(true, ["Conversa vinculada ao lead com sucesso"], [], finalConversation)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[LinkConversationToLeadUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao vincular conversa ao lead"
      return new Output(false, [], [message], null)
    }
  }
}

export const linkConversationToLeadUseCase = new LinkConversationToLeadUseCase()
