import type { BackofficeEmailDispatchCategory } from "@prisma/client"
import { backofficeEmailDispatchService } from "@/app/api/services/backofficeEmailDispatch/BackofficeEmailDispatchService"
import { createEmailService, type EmailOptions } from "@/lib/services/EmailService"

type SendTrackedProfileEmailInput = Omit<EmailOptions, "to"> & {
  profileId: string
  category: BackofficeEmailDispatchCategory
  sourceType?: string
  sourceId?: string
}

export async function sendTrackedEmailToProfileRecipients(input: SendTrackedProfileEmailInput) {
  const recipients = await backofficeEmailDispatchService.resolveProfileRecipients(input.profileId)

  if (recipients.length === 0) {
    return { success: false as const, error: "Perfil sem e-mails válidos para envio" }
  }

  const emailService = createEmailService()

  return emailService.sendEmail({
    ...input,
    to: recipients.map((recipient) => recipient.email),
    dispatch: {
      profileId: input.profileId,
      category: input.category,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
  })
}
