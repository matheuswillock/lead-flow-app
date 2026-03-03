"use client";

import { useNotificationsContext } from "./NotificationsContext";

export function useNotifications() {
  return useNotificationsContext();
}
