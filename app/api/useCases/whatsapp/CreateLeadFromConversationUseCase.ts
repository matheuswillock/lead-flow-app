import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { leadUseCase } from "@/app/api/useCases/leads/leadUseCaseFactory"
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead"
import { isGroupChat } from "@/app/api/services/whatsapp/phoneUtils"
import { whatsAppLeadActivityService } from "@/app/api/services/whatsapp/WhatsAppLeadActivityService"
import {
  resolveContactNameUpdate,
  type ContactNameSource,
} from "@/lib/whatsapp/contact-name"

const leadRepository = new LeadRepository()

interface CreateLeadFromConversationInput {
  conversationId: string
  name: string
  phone?: string
  access: TeamAccess
}

class CreateLeadFromConversationUseCase {
  async execute(input: CreateLeadFromConversationInput): Promise<Output> {
    try {
      const conversation = await assertCanAccessConversation(input.access, input.conversationId)

      if (conversation.leadId) {
        return new Output(false, [], ["Esta conversa já possui um lead vinculado"], null)
      }

      if (isGroupChat(conversation.externalChatId)) {
        return new Output(
          false,
          [],
          ["Não é possível criar lead a partir de uma conversa de grupo"],
          null
        )
      }

      const phone = (input.phone?.trim() || conversation.normalizedPhone || conversation.contactPhone).replace(
        /\D/g,
        ""
      )
      if (phone.length < 10) {
        return new Output(false, [], ["Telefone inválido para criação do lead"], null)
      }

      const createOutput = await leadUseCase.createLead(
        input.access.supabaseId,
        {
          name: input.name.trim(),
          phone,
          originChannel: "whatsapp_manual",
        } as CreateLeadRequest,
        input.access.teamId,
        {
          body: "Lead criado a partir de conversa WhatsApp",
          payload: {
            kind: "lead_creation",
            channel: "whatsapp",
            source: "whatsapp_manual",
            conversationId: input.conversationId,
          },
        },
        { autoScheduleMeeting: false }
      )

      if (!createOutput.isValid) {
        return createOutput
      }

      const createdLead = createOutput.result as { id?: string } | null
      if (!createdLead?.id) {
        return new Output(false, [], ["Erro ao criar lead"], null)
      }

      const linkedConversation = await whatsAppRepository.linkConversationToLeadIfEmpty(
        input.conversationId,
        createdLead.id
      )

      if (!linkedConversation) {
        try {
          await leadRepository.delete(createdLead.id)
        } catch (rollbackError) {
          console.error(
            "[CreateLeadFromConversationUseCase][execute] Falha ao remover lead órfão após corrida de vínculo:",
            rollbackError
          )
        }
        return new Output(false, [], ["Esta conversa já possui um lead vinculado"], null)
      }

      // Mesma regra de precedência do LinkConversationToLeadUseCase: o nome
      // entra com fonte LEAD, senão o próximo pushName inbound sobrescreveria.
      const nameUpdate = resolveContactNameUpdate({
        currentName: conversation.contactName,
        currentSource: conversation.contactNameSource as ContactNameSource,
        incomingName: input.name.trim(),
        incomingSource: "LEAD",
      })

      const finalConversation = nameUpdate
        ? await whatsAppRepository.updateConversation(input.conversationId, nameUpdate)
        : linkedConversation

      try {
        await whatsAppLeadActivityService.recordConversationMilestone({
          teamId: conversation.teamId,
          leadId: createdLead.id,
          conversationId: input.conversationId,
          milestone: "conversation_started",
          preview: finalConversation.lastMessagePreview,
        })
      } catch (activityError) {
        console.error(
          "[CreateLeadFromConversationUseCase][execute] Falha ao registrar atividade",
          activityError
        )
      }

      return new Output(
        true,
        ["Lead criado e vinculado com sucesso"],
        [],
        { leadId: createdLead.id, conversation: finalConversation }
      )
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[CreateLeadFromConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao criar lead a partir da conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const createLeadFromConversationUseCase = new CreateLeadFromConversationUseCase()
