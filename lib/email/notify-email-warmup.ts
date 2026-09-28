import { notificationService } from "@/app/api/services/notifications/NotificationService"
import { NotificationType } from "@prisma/client"

export async function notifyEmailWarmup(params: {
  recipientProfileId: string
  teamId: string
  type: "limit" | "attention" | "paused"
  message: string
  domainName?: string | null
  limit?: number | null
  deferred?: number
}): Promise<void> {
  const notificationType = NotificationType.EMAIL_SENDING_HEALTH_CHANGED
  await notificationService.createSystemNotification({
    recipientProfileId: params.recipientProfileId,
    teamId: params.teamId,
    type: notificationType,
    message: params.message,
    metadata: { event: params.type === "paused" ? "EMAIL_DOMAIN_SEND_PAUSED" : params.type === "attention" ? "EMAIL_DOMAIN_HEALTH_ATTENTION" : "EMAIL_WARMUP_LIMIT_REACHED", domainName: params.domainName ?? null, limit: params.limit ?? null, deferred: params.deferred ?? 0 },
  })
}
