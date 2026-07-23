import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import type {
  IWhatsAppRepository,
  WhatsAppInboundReadReceiptCandidate,
} from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import type { IWhatsAppProvider } from "@/app/api/services/whatsapp/provider/IWhatsAppProvider"
import { evolutionWhatsAppProvider } from "@/app/api/services/whatsapp/provider/EvolutionWhatsAppProvider"

function extractMessageKey(rawPayload: unknown): Record<string, unknown> | null {
  if (typeof rawPayload !== "object" || rawPayload === null) return null
  const record = rawPayload as Record<string, unknown>
  const key = record["key"]
  if (typeof key === "object" && key !== null) {
    return key as Record<string, unknown>
  }
  return null
}

function resolveInboundProviderMessageId(
  message: WhatsAppInboundReadReceiptCandidate
): string | null {
  if (message.providerMessageId) return message.providerMessageId
  const key = extractMessageKey(message.rawPayload)
  const id = key?.["id"]
  return typeof id === "string" && id.length > 0 ? id : null
}

function buildReadReceiptPayload(
  pending: WhatsAppInboundReadReceiptCandidate[],
  externalChatId: string
): {
  readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>
  messageIds: string[]
} {
  const readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }> = []
  const messageIds: string[] = []

  for (const message of pending) {
    const id = resolveInboundProviderMessageId(message)
    if (!id) continue
    readMessages.push({ remoteJid: externalChatId, fromMe: false, id })
    messageIds.push(message.id)
  }

  return { readMessages, messageIds }
}

class MarkConversationReadUseCase {
  constructor(
    private readonly repository: IWhatsAppRepository = whatsAppRepository,
    private readonly provider: IWhatsAppProvider = evolutionWhatsAppProvider
  ) {}

  async execute(conversationId: string, access: TeamAccess): Promise<Output> {
    try {
      await assertCanAccessConversation(access, conversationId)

      const conversation = await this.repository.findConversationByIdForTeam(
        conversationId,
        access.teamId
      )
      if (!conversation) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      const updatedConversation = await this.repository.updateConversation(conversationId, {
        unreadCount: 0,
      })

      let readReceiptSent = false

      const config = await this.repository.findConfigByTeamId(access.teamId)
      if (!config || config.status !== "CONNECTED" || !conversation.externalChatId) {
        console.info(
          "[MarkConversationReadUseCase][execute] Skipping read receipt provider call",
          {
            conversationId,
            hasConfig: Boolean(config),
            status: config?.status,
            hasExternalChatId: Boolean(conversation.externalChatId),
          }
        )
        return new Output(true, [], [], { ...updatedConversation, readReceiptSent })
      }

      const effectiveConfig = await this.repository.resolveEffectiveConfig(config)
      const pending = await this.repository.listInboundPendingReadReceipt(conversationId)
      const { readMessages, messageIds } = buildReadReceiptPayload(
        pending,
        conversation.externalChatId
      )

      if (readMessages.length === 0) {
        return new Output(true, [], [], { ...updatedConversation, readReceiptSent })
      }

      try {
        await this.provider.markMessagesAsRead({
          instanceName: effectiveConfig.instanceName,
          readMessages,
        })
        await this.repository.bulkSetInboundBrokerReadAt(messageIds, new Date())
        readReceiptSent = true
      } catch (providerError) {
        console.error("[MarkConversationReadUseCase][execute] Read receipt provider failed", providerError)
      }

      return new Output(true, [], [], { ...updatedConversation, readReceiptSent })
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[MarkConversationReadUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao marcar conversa como lida"
      return new Output(false, [], [message], null)
    }
  }
}

export const markConversationReadUseCase = new MarkConversationReadUseCase()

export {
  MarkConversationReadUseCase,
  buildReadReceiptPayload,
  resolveInboundProviderMessageId,
}
