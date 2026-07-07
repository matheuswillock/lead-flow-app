import { createIdempotentLeadActivity } from "@/lib/lead-activities/createIdempotentLeadActivity"
import type {
  ConversationMilestone,
  IWhatsAppLeadActivityService,
  RecordConversationMilestoneInput,
} from "./IWhatsAppLeadActivityService"

export const CONVERSATION_REOPENED_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

const MILESTONE_BODIES: Record<ConversationMilestone, string> = {
  conversation_started: "Conversa de WhatsApp iniciada",
  conversation_reopened: "Conversa de WhatsApp reaberta",
}

export function buildConversationMilestoneSourceKey(
  milestone: ConversationMilestone,
  conversationId: string,
  reopenedAt?: Date
): string {
  if (milestone === "conversation_started") {
    return `whatsapp:conversation_started:${conversationId}`
  }

  const dateKey = (reopenedAt ?? new Date()).toISOString().slice(0, 10)
  return `whatsapp:conversation_reopened:${conversationId}:${dateKey}`
}

export function shouldRecordConversationReopened(
  lastMessageAt: Date | null | undefined,
  now: Date
): boolean {
  if (!lastMessageAt) return false
  return now.getTime() - lastMessageAt.getTime() >= CONVERSATION_REOPENED_THRESHOLD_MS
}

export class WhatsAppLeadActivityService implements IWhatsAppLeadActivityService {
  async recordConversationMilestone(input: RecordConversationMilestoneInput): Promise<void> {
    const sourceKey = buildConversationMilestoneSourceKey(
      input.milestone,
      input.conversationId,
      input.reopenedAt
    )

    await createIdempotentLeadActivity({
      leadId: input.leadId,
      type: "whatsapp",
      body: MILESTONE_BODIES[input.milestone],
      sourceKey,
      createdBy: null,
      payload: {
        conversationId: input.conversationId,
        milestone: input.milestone,
        teamId: input.teamId,
        ...(input.preview ? { preview: input.preview } : {}),
      },
    })
  }
}

export const whatsAppLeadActivityService = new WhatsAppLeadActivityService()
