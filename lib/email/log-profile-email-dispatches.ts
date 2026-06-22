import type { BackofficeEmailDispatchCategory } from "@prisma/client"
import { backofficeEmailDispatchService } from "@/app/api/services/backofficeEmailDispatch/BackofficeEmailDispatchService"

export async function logGoogleCalendarDispatchesForRecipients(input: {
  recipients: string[]
  subject: string
  category: BackofficeEmailDispatchCategory
  sourceType?: string
  sourceId?: string
  success: boolean
  errorMessage?: string | null
}) {
  const matches = await backofficeEmailDispatchService.resolveProfilesByRecipientEmails(input.recipients)

  await Promise.all(
    matches.map((match) =>
      backofficeEmailDispatchService.recordGoogleDispatch({
        profileId: match.profileId,
        recipientEmail: match.email,
        recipientKind: match.kind,
        provider: "google_calendar",
        category: input.category,
        subject: input.subject,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        success: input.success,
        errorMessage: input.errorMessage,
      })
    )
  )
}

export async function logResendDispatchesForRecipients(input: {
  recipients: string[]
  subject: string
  category: BackofficeEmailDispatchCategory
  sourceType?: string
  sourceId?: string
  resendEmailId?: string | null
  errorMessage?: string | null
}) {
  const matches = await backofficeEmailDispatchService.resolveProfilesByRecipientEmails(input.recipients)

  await Promise.all(
    matches.map(async (match) => {
      const dispatchId = await backofficeEmailDispatchService.createQueuedDispatch({
        profileId: match.profileId,
        recipientEmail: match.email,
        recipientKind: match.kind,
        provider: "resend",
        category: input.category,
        subject: input.subject,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      })

      if (input.resendEmailId) {
        await backofficeEmailDispatchService.markSent(dispatchId, input.resendEmailId)
        return
      }

      await backofficeEmailDispatchService.markFailed(
        dispatchId,
        input.errorMessage || "Falha ao enviar convite por e-mail"
      )
    })
  )
}
