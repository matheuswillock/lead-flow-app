export type ConversationMilestone = "conversation_started" | "conversation_reopened"

export type RecordConversationMilestoneInput = {
  teamId: string
  leadId: string
  conversationId: string
  milestone: ConversationMilestone
  preview?: string | null
  reopenedAt?: Date
}

export interface IWhatsAppLeadActivityService {
  recordConversationMilestone(input: RecordConversationMilestoneInput): Promise<void>
}
