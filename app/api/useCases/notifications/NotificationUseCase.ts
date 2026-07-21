import { Output } from "@/lib/output";
import { notificationService } from "@/app/api/services/notifications/NotificationService";

type ListNotificationsInput = {
  recipientProfileId: string;
  limit?: number;
  offset?: number;
};

type NotificationRecipientInput = {
  recipientProfileId: string;
};

export class NotificationUseCase {
  async listNotifications(input: ListNotificationsInput): Promise<Output> {
    try {
      const limit = Math.max(1, Math.min(input.limit ?? 100, 200));
      const offset = Math.max(0, input.offset ?? 0);

      const result = await notificationService.listByRecipient({
        recipientProfileId: input.recipientProfileId,
        limit,
        offset,
      });

      return new Output(true, [], [], {
        notifications: result.notifications,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("[NotificationUseCase][listNotifications] Erro ao listar notificações:", error);
      return new Output(false, [], ["Erro ao listar notificações"], null);
    }
  }

  async countUnread(input: NotificationRecipientInput): Promise<Output> {
    try {
      const unreadCount = await notificationService.countUnreadByRecipient(input);
      return new Output(true, [], [], { unreadCount });
    } catch (error) {
      console.error("[NotificationUseCase][countUnread] Erro ao contar notificações:", error);
      return new Output(false, [], ["Erro ao consultar notificações"], null);
    }
  }

  async markAllAsRead(input: NotificationRecipientInput): Promise<Output> {
    try {
      const markedCount = await notificationService.markAllAsReadByRecipient(input);
      return new Output(true, ["Notificações marcadas como vistas"], [], { markedCount });
    } catch (error) {
      console.error("[NotificationUseCase][markAllAsRead] Erro ao atualizar notificações:", error);
      return new Output(false, [], ["Erro ao marcar notificações como vistas"], null);
    }
  }
}

export const notificationUseCase = new NotificationUseCase();
