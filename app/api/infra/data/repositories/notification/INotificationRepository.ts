import type { NotificationType, Prisma } from "@prisma/client"

export interface CreateSystemNotificationInput {
  teamId: string
  recipientProfileId: string
  type: NotificationType
  message: string
  metadata?: Prisma.InputJsonValue
}

export interface INotificationRepository {
  createSystemNotification(input: CreateSystemNotificationInput): Promise<void>
}
