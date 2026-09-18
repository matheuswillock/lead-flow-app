import { NotificationType } from "@prisma/client"
import { notificationService } from "@/app/api/services/notifications/NotificationService"

/**
 * Notificação ao owner do time nas transições da trava de reputação — mesmo
 * padrão de `notify-campaign-dispatch-failure.ts`: os consumidores (use cases)
 * importam esta lib, nunca o `notificationService` direto, para os testes de
 * use case poderem mockar um módulo só (o service puxa `lib/cache/invalidation`,
 * que é `server-only` e explode fora do runtime do Next).
 */
export async function notifySendingHealthChanged(params: {
  recipientProfileId: string
  teamId: string
  status: string
  previousStatus?: string | null
  reason: string | null
  message: string
  trigger: "cron_evaluation" | "manual_release_owner" | "dispatch_bounce_abort"
  extraMetadata?: Record<string, unknown>
}): Promise<void> {
  await notificationService.createSystemNotification({
    recipientProfileId: params.recipientProfileId,
    teamId: params.teamId,
    type: NotificationType.EMAIL_SENDING_HEALTH_CHANGED,
    message: params.message,
    metadata: {
      event: "EMAIL_SENDING_HEALTH_CHANGED",
      status: params.status,
      previousStatus: params.previousStatus ?? null,
      reason: params.reason,
      trigger: params.trigger,
      ...(params.extraMetadata ?? {}),
    },
  })
}
