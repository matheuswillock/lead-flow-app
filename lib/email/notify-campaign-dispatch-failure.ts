import { NotificationType } from "@prisma/client"
import { notificationService } from "@/app/api/services/notifications/NotificationService"
import { sendTrackedEmailToProfileRecipients } from "@/lib/email/send-tracked-profile-email"
import { getFullUrl } from "@/lib/utils/app-url"
import { prisma } from "@/app/api/infra/data/prisma"

const notifiedDispatchIds = new Set<string>()

export async function notifyCampaignDispatchFailure(params: {
  recipientProfileId: string
  teamId: string
  campaignId: string
  campaignName: string
  dispatchId?: string
  errorMessage: string
}): Promise<void> {
  if (params.dispatchId) {
    if (notifiedDispatchIds.has(params.dispatchId)) return
    notifiedDispatchIds.add(params.dispatchId)
  }

  const message = `A campanha "${params.campaignName}" falhou no disparo: ${params.errorMessage}`

  await notificationService.createSystemNotification({
    recipientProfileId: params.recipientProfileId,
    teamId: params.teamId,
    type: NotificationType.EMAIL_CAMPAIGN_DISPATCH_FAILED,
    message,
    metadata: {
      event: "EMAIL_CAMPAIGN_DISPATCH_FAILED",
      campaignId: params.campaignId,
      dispatchId: params.dispatchId,
      errorMessage: params.errorMessage,
    },
  })

  const profile = await prisma.profile.findUnique({
    where: { id: params.recipientProfileId },
    select: { supabaseId: true },
  })

  const campaignsUrl = profile?.supabaseId
    ? getFullUrl(`/${profile.supabaseId}/email/campanhas`)
    : getFullUrl("/")

  await sendTrackedEmailToProfileRecipients({
    profileId: params.recipientProfileId,
    category: "other",
    sourceType: "email_campaign_dispatch_failed",
    sourceId: params.dispatchId ?? params.campaignId,
    subject: `Falha no disparo da campanha ${params.campaignName}`,
    html: `
      <p>Olá,</p>
      <p>O disparo da campanha <strong>${params.campaignName}</strong> não foi concluído.</p>
      <p><strong>Motivo:</strong> ${params.errorMessage}</p>
      <p><a href="${campaignsUrl}">Abrir campanhas de e-mail</a></p>
    `,
  }).catch((error) => {
    console.error("[notifyCampaignDispatchFailure] falha ao enviar e-mail", error)
  })
}

export function resetCampaignDispatchFailureNotificationCacheForTests(): void {
  notifiedDispatchIds.clear()
}
