import type { NotificationItem } from "@/app/[supabaseId]/notifications/features/types/notification.types";

type InAppNotificationListener = (notification: NotificationItem) => void;

const listeners = new Set<InAppNotificationListener>();

export const inAppNotificationBridge = {
  subscribe(listener: InAppNotificationListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emit(notification: NotificationItem) {
    for (const listener of listeners) {
      listener(notification);
    }
  },
};
