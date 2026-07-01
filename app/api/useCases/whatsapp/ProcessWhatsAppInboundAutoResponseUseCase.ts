import type { WhatsAppAutoResponseRuleType } from "@prisma/client"
import {
  isUniqueConstraintError,
  whatsAppAutoResponseRepository,
} from "@/app/api/infra/data/repositories/whatsapp/WhatsAppAutoResponseRepository"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import { isGroupChat } from "@/app/api/services/whatsapp/phoneUtils"
import { pickAutoResponseRule } from "@/lib/whatsapp/auto-response-evaluation"
import { teamHasWhatsAppFeature } from "@/lib/whatsapp/team-has-whatsapp-feature"
import { resolveTimezone } from "@/lib/dates"
import { whatsAppLeadSyncUseCase } from "@/app/api/useCases/whatsapp/WhatsAppLeadSyncUseCase"
import { Output } from "@/lib/output"

const KEYWORD_DEDUP_MS = 60_000
const OFF_HOURS_DEDUP_MS = 60_000
const WELCOME_DEDUP_MS = 24 * 60 * 60_000

interface ProcessInboundAutoResponseInput {
  teamId: string
  configId: string
  conversationId: string
  externalChatId: string
  inboundMessageId: string
  inboundText: string | null | undefined
  contactName?: string | null
  normalizedPhone: string
}

export type ProcessInboundAutoResponseResult = {
  sent: boolean
  ruleId?: string
  ruleType?: WhatsAppAutoResponseRuleType
  outboundMessageId?: string
}

class ProcessWhatsAppInboundAutoResponseUseCase {
  private async buildSkipRuleTypes(
    conversationId: string,
    welcomeSentAt: Date | null | undefined
  ): Promise<Set<WhatsAppAutoResponseRuleType>> {
    const skip = new Set<WhatsAppAutoResponseRuleType>()
    const now = Date.now()

    if (
      welcomeSentAt ||
      (await whatsAppAutoResponseRepository.hasRecentLog({
        conversationId,
        ruleType: "WELCOME",
        since: new Date(now - WELCOME_DEDUP_MS),
      }))
    ) {
      skip.add("WELCOME")
    }

    if (
      await whatsAppAutoResponseRepository.hasRecentLog({
        conversationId,
        ruleType: "OFF_HOURS",
        since: new Date(now - OFF_HOURS_DEDUP_MS),
      })
    ) {
      skip.add("OFF_HOURS")
    }

    if (
      await whatsAppAutoResponseRepository.hasRecentLog({
        conversationId,
        ruleType: "KEYWORD",
        since: new Date(now - KEYWORD_DEDUP_MS),
      })
    ) {
      skip.add("KEYWORD")
    }

    return skip
  }

  async execute(input: ProcessInboundAutoResponseInput): Promise<Output> {
    try {
      if (isGroupChat(input.externalChatId)) {
        return new Output(true, [], [], { sent: false })
      }

      const hasFeature = await teamHasWhatsAppFeature(input.teamId)
      if (!hasFeature) {
        return new Output(true, [], [], { sent: false })
      }

      const conversation = await whatsAppRepository.findConversationById(input.conversationId)
      if (!conversation) {
        return new Output(true, [], [], { sent: false })
      }
      if (conversation.handoffMode === "HUMAN" || conversation.isArchived) {
        return new Output(true, [], [], { sent: false })
      }

      const rules = await whatsAppAutoResponseRepository.listActiveRulesByConfigId(input.configId)
      if (rules.length === 0) {
        return new Output(true, [], [], { sent: false })
      }

      const welcomeRuleActive = rules.some((rule) => rule.type === "WELCOME")
      if (welcomeRuleActive && !conversation.leadId) {
        const masterContext = await whatsAppRepository.findTeamMasterContext(input.teamId)
        if (masterContext) {
          await whatsAppLeadSyncUseCase.execute({
            teamId: input.teamId,
            conversationId: input.conversationId,
            normalizedPhone: input.normalizedPhone,
            contactName: input.contactName,
            masterId: masterContext.masterId,
          })
        }
      }

      const inboundText = input.inboundText?.trim() ?? ""
      if (!inboundText) {
        return new Output(true, [], [], { sent: false })
      }

      const masterContext = await whatsAppRepository.findTeamMasterContext(input.teamId)
      const teamTimezone = resolveTimezone(masterContext?.timezone)
      const skipRuleTypes = await this.buildSkipRuleTypes(
        input.conversationId,
        conversation.welcomeSentAt
      )

      const selectedRule = pickAutoResponseRule({
        rules,
        inboundText,
        teamTimezone,
        skipRuleTypes,
      })

      if (!selectedRule || !selectedRule.replyMessage.trim()) {
        return new Output(true, [], [], { sent: false })
      }

      // Compare-and-swap em welcomeSentAt: garante que, mesmo com duas
      // mensagens inbound concorrentes disparando a regra WELCOME pela
      // primeira vez, só uma delas "ganhe" o direito de enviar a boas-vindas.
      if (selectedRule.type === "WELCOME") {
        const claimedWelcome = await whatsAppRepository.claimWelcomeSlot(input.conversationId)
        if (!claimedWelcome) {
          return new Output(true, [], [], { sent: false })
        }
      }

      const replyText = selectedRule.replyMessage.trim()

      // Reivindica o log ANTES de enviar: a unique constraint em
      // (conversationId, ruleType, inboundMessageId) impede que a mesma
      // mensagem inbound (redelivery de webhook ou corrida no
      // ProcessEvoWebhookUseCase) dispare a mesma regra duas vezes.
      let claimedLog: { id: string }
      try {
        claimedLog = await whatsAppAutoResponseRepository.createLog({
          conversation: { connect: { id: input.conversationId } },
          rule: { connect: { id: selectedRule.id } },
          ruleType: selectedRule.type,
          triggerText: inboundText,
          sentText: replyText,
          inboundMessageId: input.inboundMessageId,
        })
      } catch (claimError) {
        if (isUniqueConstraintError(claimError)) {
          return new Output(true, [], [], { sent: false })
        }
        throw claimError
      }

      try {
        const sendResult = await whatsAppService.sendAutoResponseMessage({
          teamId: input.teamId,
          conversationId: input.conversationId,
          contentText: replyText,
          autoResponseRuleId: selectedRule.id,
        })

        await whatsAppAutoResponseRepository.updateLogOutbound(claimedLog.id, sendResult.messageId)

        return new Output(true, [], [], {
          sent: true,
          ruleId: selectedRule.id,
          ruleType: selectedRule.type,
          outboundMessageId: sendResult.messageId,
        })
      } catch (sendError) {
        await whatsAppAutoResponseRepository.deleteLog(claimedLog.id).catch(() => {})

        if (selectedRule.type === "WELCOME") {
          // Libera o slot de boas-vindas para que uma próxima mensagem
          // inbound possa tentar novamente, já que o envio falhou.
          await whatsAppRepository
            .updateConversation(input.conversationId, { welcomeSentAt: null })
            .catch(() => {})
        }
        throw sendError
      }
    } catch (error) {
      console.error("[ProcessWhatsAppInboundAutoResponseUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao processar auto-resposta"
      return new Output(false, [], [message], { sent: false })
    }
  }
}

export const processWhatsAppInboundAutoResponseUseCase = new ProcessWhatsAppInboundAutoResponseUseCase()
