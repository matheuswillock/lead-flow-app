import prisma from "@/app/api/infra/data/prisma"
import type {
  CreateSystemNotificationInput,
  INotificationRepository,
} from "./INotificationRepository"

export class NotificationRepository implements INotificationRepository {
  async createSystemNotification(input: CreateSystemNotificationInput): Promise<void> {
    await prisma.notification.create({
      data: {
        teamId: input.teamId,
        recipientProfileId: input.recipientProfileId,
        type: input.type,
        message: input.message,
        metadata: input.metadata,
      },
    })
  }
}

export const notificationRepository = new NotificationRepository()
