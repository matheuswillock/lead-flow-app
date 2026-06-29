"use client";

import { useNotifications } from "../context/NotificationsHook";
import { useNotificationFaviconBadge } from "../hooks/useNotificationFaviconBadge";

export function NotificationFaviconBadge() {
  const { unreadCount } = useNotifications();
  useNotificationFaviconBadge(unreadCount);
  return null;
}
