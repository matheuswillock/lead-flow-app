"use client";

import { AnimatePresence } from "framer-motion";
import { useInAppNotifications } from "../context/InAppNotificationContext";
import { InAppNotificationBubble } from "./InAppNotificationBubble";

export function InAppNotificationStack() {
  const { visibleNotifications, dismiss } = useInAppNotifications();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-3">
      <AnimatePresence>
        {visibleNotifications.map((notification) => (
          <InAppNotificationBubble
            key={notification.queueId}
            notification={notification}
            onDismiss={dismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
