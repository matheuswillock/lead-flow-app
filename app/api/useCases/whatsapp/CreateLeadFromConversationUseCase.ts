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

      const trimmedName = input.name.trim()
      const finalConversation =
        trimmedName && trimmedName !== conversation.contactName?.trim()
          ? await whatsAppRepository.updateConversation(input.conversationId, {
              contactName: trimmedName,
            })
          : linkedConversation

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
