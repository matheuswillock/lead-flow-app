import { ActivityType, LeadStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface LinkOrCreateInput {
  teamId: string
  conversationId: string
  normalizedPhone: string
  contactName?: string | null
  masterId: string
}

class WhatsAppLeadSyncUseCase {
  private async generateLeadCode(name: string): Promise<string> {
    const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "")
    const firstLetter = (clean[0] || "L").toUpperCase()
    const lastLetter = (clean[clean.length - 1] || "D").toUpperCase()

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const digitsLength = 4 + Math.floor(Math.random() * 3)
      const digits = Array.from({ length: digitsLength }, () => Math.floor(Math.random() * 10)).join("")
      const code = `${firstLetter}${digits}${lastLetter}`
      const existing = await leadRepository.findByLeadCode(code)
      if (!existing) return code
    }

    const fallbackDigits = Date.now().toString().slice(-6)
    return `${firstLetter}${fallbackDigits}${lastLetter}`
  }

  async execute(input: LinkOrCreateInput): Promise<Output> {
    try {
      const conversation = await whatsAppRepository.findConversationById(input.conversationId)
      if (!conversation) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }
      if (conversation.leadId) {
        return new Output(true, [], [], conversation.leadId)
      }

      const existingLead = await leadRepository.findLeadByPhoneInTeam(
        input.teamId,
        input.normalizedPhone
      )

      if (existingLead) {
        await whatsAppRepository.linkConversationToLead(input.conversationId, existingLead.id)
        return new Output(true, [], [], existingLead.id)
      }

      const displayName = input.contactName?.trim() || input.normalizedPhone
      const leadCode = await this.generateLeadCode(displayName)

      const lead = await leadRepository.create({
        manager: { connect: { id: input.masterId } },
        team: { connect: { id: input.teamId } },
        leadCode,
        name: displayName,
        phone: input.normalizedPhone,
        status: LeadStatus.new_opportunity,
        creator: { connect: { id: input.masterId } },
        updater: { connect: { id: input.masterId } },
        activities: {
          create: {
            type: ActivityType.note,
            body: "Lead criado automaticamente via WhatsApp",
            payload: {
              kind: "lead_creation",
              channel: "whatsapp",
              provider: "evolution",
              source: "whatsapp_inbound",
              conversationId: input.conversationId,
              importedAt: new Date().toISOString(),
            },
            author: { connect: { id: input.masterId } },
          },
        },
      })

      await whatsAppRepository.linkConversationToLead(input.conversationId, lead.id)
      console.info("[WhatsAppLeadSyncUseCase][execute] Lead created", lead.id)
      return new Output(true, [], [], lead.id)
    } catch (error) {
      console.error("[WhatsAppLeadSyncUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar lead"
      return new Output(false, [], [message], null)
    }
  }
}

export const whatsAppLeadSyncUseCase = new WhatsAppLeadSyncUseCase()
