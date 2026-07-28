import { createHash } from "node:crypto"
import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { evolutionWhatsAppProvider } from "@/app/api/services/whatsapp/provider/EvolutionWhatsAppProvider"
import { WhatsAppProviderCapabilityError } from "@/app/api/services/whatsapp/provider/IWhatsAppProvider"
import { whatsappError } from "@/lib/whatsapp/api-error"
import { emitWhatsAppSloMetric } from "@/lib/whatsapp/slo-metrics"

function actionRequestHash(input: {
  teamId: string
  messageId: string
  clientActionId: string
  kind: string
  emoji?: string
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        teamId: input.teamId,
        messageId: input.messageId,
        clientActionId: input.clientActionId,
        kind: input.kind,
        emoji: input.emoji ?? null,
      })
    )
    .digest("hex")
}

export type WhatsAppMessageAction =
  | { kind: "REACT"; emoji: string }
  | { kind: "UNREACT"; emoji: string }
  | { kind: "PIN"; expiresAt?: string }
  | { kind: "UNPIN" }
  | { kind: "FAVORITE" }
  | { kind: "UNFAVORITE" }
  | { kind: "DELETE_FOR_ME" }
  | { kind: "DELETE_FOR_EVERYONE" }

export type MessageActionResult = {
  messageId: string
  action: WhatsAppMessageAction["kind"]
  status: "APPLIED" | "PENDING" | "UNKNOWN" | "FAILED"
  providerCapability: "LOCAL" | "SUPPORTED" | "UNAVAILABLE"
  idempotentReplay: boolean
}

type MessageActionInput = {
  teamId: string
  messageId: string
  clientActionId: string
  action: WhatsAppMessageAction
  access: TeamAccess
}

type MessageActionsStateResult = {
  messageId: string
  capabilities: {
    reply: boolean
    forward: boolean
    react: boolean
    deleteForEveryone: boolean
  }
  state: {
    isPinned: boolean
    isFavorite: boolean
    isHiddenForMe: boolean
    deletedForEveryoneAt: string | null
    direction: string
    reactions: Array<{ emoji: string; profileId: string | null }>
  }
}

class MessageActionUseCase {
  async execute(input: MessageActionInput): Promise<Output> {
    try {
      const message = await whatsAppRepository.findMessageByIdForTeam(input.teamId, input.messageId)
      if (!message || message.deletedForEveryoneAt) {
        return new Output(false, [], ["Mensagem não encontrada"], whatsappError("VALIDATION_ERROR"))
      }

      await assertCanAccessConversation(input.access, message.conversationId)

      const priorState = await whatsAppRepository.getMessageActionsState({
        teamId: input.teamId,
        messageId: message.id,
        profileId: input.access.profileId,
      })
      if (!priorState || priorState.isHidden) {
        return new Output(false, [], ["Mensagem não encontrada"], whatsappError("VALIDATION_ERROR"))
      }

      const action = input.action
      const caps = evolutionWhatsAppProvider.getMessageActionCapabilities()
      const profileId = input.access.profileId

      if (action.kind === "REACT" || action.kind === "UNREACT" || action.kind === "DELETE_FOR_EVERYONE") {
        const kind = action.kind
        const needsReact = action.kind === "REACT" || action.kind === "UNREACT"
        if ((needsReact && !caps.react) || (action.kind === "DELETE_FOR_EVERYONE" && !caps.deleteForEveryone)) {
          emitWhatsAppSloMetric("whatsapp_action_capability_unavailable", {
            action: kind,
            teamScoped: true,
          })
          return new Output(
            false,
            [],
            [
              needsReact
                ? "Reação não disponível neste provedor."
                : "Apagar para todos não está disponível neste provedor.",
            ],
            whatsappError("CAPABILITY_UNAVAILABLE")
          )
        }

        if (!message.providerMessageId) {
          return new Output(
            false,
            [],
            ["Mensagem ainda sem confirmação do provedor."],
            whatsappError("VALIDATION_ERROR")
          )
        }

        const emoji = action.kind === "REACT" || action.kind === "UNREACT" ? action.emoji : undefined
        if ((action.kind === "REACT" || action.kind === "UNREACT") && !emoji?.trim()) {
          return new Output(false, [], ["Emoji obrigatório."], whatsappError("VALIDATION_ERROR"))
        }

        const hash = actionRequestHash({
          teamId: input.teamId,
          messageId: message.id,
          clientActionId: input.clientActionId,
          kind,
          emoji,
        })
        const command = await whatsAppRepository.createActionCommand({
          teamId: input.teamId,
          messageId: message.id,
          profileId,
          clientActionId: input.clientActionId,
          kind,
          requestHash: hash,
          emoji: emoji ?? null,
        })
        if (!command.created) {
          const result: MessageActionResult = {
            messageId: message.id,
            action: kind,
            status: (command.status as MessageActionResult["status"]) || "UNKNOWN",
            providerCapability: "SUPPORTED",
            idempotentReplay: true,
          }
          return new Output(true, ["Ação já registrada"], [], result)
        }

        const conversation = await whatsAppRepository.findConversationByIdForTeam(
          message.conversationId,
          input.teamId
        )
        const config = await whatsAppRepository.findConfigByTeamId(input.teamId)
        if (!conversation?.externalChatId || !config?.instanceName) {
          return new Output(
            false,
            [],
            ["Configuração WhatsApp indisponível."],
            whatsappError("INTERNAL_ERROR")
          )
        }

        try {
          if (action.kind === "REACT") {
            await evolutionWhatsAppProvider.reactToMessage({
              instanceName: config.instanceName,
              remoteJid: conversation.externalChatId,
              providerMessageId: message.providerMessageId,
              fromMe: message.direction === "OUTBOUND",
              emoji: action.emoji.trim(),
            })
          } else if (action.kind === "UNREACT") {
            await evolutionWhatsAppProvider.unreactToMessage({
              instanceName: config.instanceName,
              remoteJid: conversation.externalChatId,
              providerMessageId: message.providerMessageId,
              fromMe: message.direction === "OUTBOUND",
              emoji: action.emoji.trim(),
            })
          } else {
            await evolutionWhatsAppProvider.deleteForEveryone({
              instanceName: config.instanceName,
              remoteJid: conversation.externalChatId,
              providerMessageId: message.providerMessageId,
              fromMe: message.direction === "OUTBOUND",
            })
            await whatsAppRepository.markMessageDeletedForEveryone(message.id, profileId)
          }

          await whatsAppRepository.createAuditEvent({
            teamId: input.teamId,
            conversationId: message.conversationId,
            actorProfileId: profileId,
            action: `message.action.${kind.toLowerCase()}`,
            metadata: { messageId: message.id, clientActionId: input.clientActionId },
          })

          const result: MessageActionResult = {
            messageId: message.id,
            action: kind,
            status: "UNKNOWN",
            providerCapability: "SUPPORTED",
            idempotentReplay: false,
          }
          return new Output(true, ["Ação enviada ao provedor"], [], result)
        } catch (providerError) {
          if (providerError instanceof WhatsAppProviderCapabilityError) {
            emitWhatsAppSloMetric("whatsapp_action_capability_unavailable", {
              action: kind,
              teamScoped: true,
            })
            return new Output(
              false,
              [],
              ["Ação não disponível neste provedor."],
              whatsappError("CAPABILITY_UNAVAILABLE")
            )
          }
          emitWhatsAppSloMetric("whatsapp_send_unknown", { action: kind })
          const result: MessageActionResult = {
            messageId: message.id,
            action: kind,
            status: "UNKNOWN",
            providerCapability: "SUPPORTED",
            idempotentReplay: false,
          }
          return new Output(true, ["Ação em estado incerto"], [], result)
        }
      }

      let idempotentReplay = false
      const kind = action.kind

      switch (action.kind) {
        case "PIN": {
          const expiresAt = action.expiresAt ? new Date(action.expiresAt) : null
          if (expiresAt && Number.isNaN(expiresAt.getTime())) {
            return new Output(false, [], ["expiresAt inválido."], whatsappError("VALIDATION_ERROR"))
          }
          idempotentReplay = priorState.isPinned
          await whatsAppRepository.pinMessage({
            teamId: input.teamId,
            conversationId: message.conversationId,
            messageId: message.id,
            pinnedByProfileId: profileId,
            expiresAt,
          })
          break
        }
        case "UNPIN": {
          idempotentReplay = !priorState.isPinned
          await whatsAppRepository.unpinMessage({
            teamId: input.teamId,
            messageId: message.id,
          })
          break
        }
        case "FAVORITE": {
          idempotentReplay = priorState.isFavorite
          await whatsAppRepository.upsertMessageFavorite({
            teamId: input.teamId,
            messageId: message.id,
            profileId,
          })
          break
        }
        case "UNFAVORITE": {
          idempotentReplay = !priorState.isFavorite
          await whatsAppRepository.removeMessageFavorite({
            teamId: input.teamId,
            messageId: message.id,
            profileId,
          })
          break
        }
        case "DELETE_FOR_ME": {
          idempotentReplay = priorState.isHidden
          await whatsAppRepository.hideMessageForProfile({
            teamId: input.teamId,
            messageId: message.id,
            profileId,
          })
          break
        }
        default: {
          const _exhaustive: never = action
          return new Output(false, [], [`Ação não suportada: ${JSON.stringify(_exhaustive)}`], whatsappError("VALIDATION_ERROR"))
        }
      }

      await whatsAppRepository.createAuditEvent({
        teamId: input.teamId,
        conversationId: message.conversationId,
        actorProfileId: profileId,
        action: `message.action.${kind.toLowerCase()}`,
        metadata: { messageId: message.id, clientActionId: input.clientActionId },
      })

      const result: MessageActionResult = {
        messageId: message.id,
        action: kind,
        status: "APPLIED",
        providerCapability: "LOCAL",
        idempotentReplay,
      }
      return new Output(true, ["Ação aplicada"], [], result)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], whatsappError("ACCESS_DENIED"))
      }
      console.error("[MessageActionUseCase][execute]", error)
      return new Output(false, [], ["Não foi possível aplicar a ação."], whatsappError("INTERNAL_ERROR"))
    }
  }

  async getActionsState(input: {
    teamId: string
    messageId: string
    access: TeamAccess
  }): Promise<Output> {
    try {
      const message = await whatsAppRepository.findMessageByIdForTeam(input.teamId, input.messageId)
      if (!message) {
        return new Output(false, [], ["Mensagem não encontrada"], whatsappError("VALIDATION_ERROR"))
      }

      await assertCanAccessConversation(input.access, message.conversationId)

      const state = await whatsAppRepository.getMessageActionsState({
        teamId: input.teamId,
        messageId: message.id,
        profileId: input.access.profileId,
      })
      if (!state) {
        return new Output(false, [], ["Mensagem não encontrada"], whatsappError("VALIDATION_ERROR"))
      }

      const caps = evolutionWhatsAppProvider.getMessageActionCapabilities()
      const result: MessageActionsStateResult = {
        messageId: message.id,
        capabilities: {
          reply: caps.reply,
          forward: caps.forward,
          react: caps.react,
          deleteForEveryone: caps.deleteForEveryone,
        },
        state: {
          isPinned: state.isPinned,
          isFavorite: state.isFavorite,
          isHiddenForMe: state.isHidden,
          deletedForEveryoneAt: state.deletedForEveryoneAt?.toISOString() ?? null,
          direction: message.direction,
          reactions: state.reactions.map((reaction) => ({
            emoji: reaction.emoji,
            profileId: reaction.profileId,
          })),
        },
      }
      return new Output(true, [], [], result)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], whatsappError("ACCESS_DENIED"))
      }
      console.error("[MessageActionUseCase][getActionsState]", error)
      return new Output(false, [], ["Não foi possível obter o estado da mensagem."], whatsappError("INTERNAL_ERROR"))
    }
  }
}

export const messageActionUseCase = new MessageActionUseCase()
