import { createIdempotentLeadActivity } from "@/lib/lead-activities/createIdempotentLeadActivity"
import { resolveLeadIdFromRecipientEmail } from "@/lib/lead-activities/resolveLeadIdFromRecipientEmail"

export type RecordCampaignDispatchLeadActivityInput = {
  teamId: string
  campaignId: string
  dispatchId: string
  recipientEmail: string
  subject: string
}

export class EmailCampaignLeadActivityService {
  async recordDispatchForRecipient(input: RecordCampaignDispatchLeadActivityInput): Promise<void> {
    const leadId = await resolveLeadIdFromRecipientEmail(input.teamId, input.recipientEmail)
    if (!leadId) return

    const trimmedSubject = input.subject.trim() || "Sem assunto"

    await createIdempotentLeadActivity({
      leadId,
      type: "email",
      body: `E-mail enviado: ${trimmedSubject}`,
      sourceKey: `email:dispatch:${input.dispatchId}`,
      createdBy: null,
      payload: {
        campaignId: input.campaignId,
        subject: trimmedSubject,
        dispatchId: input.dispatchId,
      },
    })
  }
}

export const emailCampaignLeadActivityService = new EmailCampaignLeadActivityService()
