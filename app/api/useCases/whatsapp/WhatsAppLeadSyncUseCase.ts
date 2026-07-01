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

      const displayName = input.contactName?.trim() || input.normalizedPhone
      const leadCode = await this.generateLeadCode(displayName)

      // findOrCreateLeadByPhoneInTeam serializa a operação com um advisory
      // lock por (teamId, normalizedPhone) dentro de uma transação, evitando
      // que mensagens inbound concorrentes criem leads duplicados para o
      // mesmo contato (não há constraint única (teamId, phone) viável hoje
      // por poder já existir dados legados duplicados).
      const result = await leadRepository.findOrCreateLeadByPhoneInTeam({
        teamId: input.teamId,
        normalizedPhone: input.normalizedPhone,
        leadCode,
        displayName,
        masterId: input.masterId,
        conversationId: input.conversationId,
      })

      if (result.created) {
        console.info("[WhatsAppLeadSyncUseCase][execute] Lead created", result.id)
      }

      await whatsAppRepository.linkConversationToLead(input.conversationId, result.id)
      return new Output(true, [], [], result.id)
    } catch (error) {
      console.error("[WhatsAppLeadSyncUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar lead"
      return new Output(false, [], [message], null)
    }
  }
}

export const whatsAppLeadSyncUseCase = new WhatsAppLeadSyncUseCase()
