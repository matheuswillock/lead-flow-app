"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NotificationItem } from "../types/notification.types";
import { inAppNotificationBridge } from "@/lib/notifications/in-app-notification-bridge";
import { InAppNotificationStack } from "../components/InAppNotificationStack";

const MAX_VISIBLE_BUBBLES = 3;
const AUTO_DISMISS_MS = 8000;

type QueuedNotification = NotificationItem & {
  queueId: string;
};

type InAppNotificationContextValue = {
  enqueue: (notification: NotificationItem) => void;
  dismiss: (queueId: string) => void;
  visibleNotifications: QueuedNotification[];
};

const InAppNotificationContext = createContext<InAppNotificationContextValue | undefined>(undefined);

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((queueId: string) => {
    const timer = timersRef.current.get(queueId);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(queueId);
    }
    setQueue((prev) => prev.filter((item) => item.queueId !== queueId));
  }, []);

  const enqueue = useCallback(
    (notification: NotificationItem) => {
      const queueId = `${notification.id}-${Date.now()}`;
      setQueue((prev) => {
        const next = [{ ...notification, queueId }, ...prev];
        return next.slice(0, MAX_VISIBLE_BUBBLES);
      });

      const timer = window.setTimeout(() => {
        dismiss(queueId);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(queueId, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return inAppNotificationBridge.subscribe((notification) => {
      if (typeof document !== "undefined" && document.visibilityState === "visible" && !notification.isRead) {
        enqueue(notification);
      }
    });
  }, [enqueue]);

  const value = useMemo(
    () => ({
      enqueue,
      dismiss,
      visibleNotifications: queue,
    }),
    [enqueue, dismiss, queue],
  );

  return (
    <InAppNotificationContext.Provider value={value}>
      {children}
      <InAppNotificationStack />
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotifications() {
  const context = useContext(InAppNotificationContext);
  if (!context) {
    throw new Error("useInAppNotifications must be used within InAppNotificationProvider");
  }
  return context;
}
