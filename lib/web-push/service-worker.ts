/// <reference lib="webworker" />

import { APP_NOTIFICATION_TITLE, DEFAULT_NOTIFICATION_URL } from "./constants";
import { handleNotificationClick, handlePushEvent } from "./service-worker-handlers";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event: PushEvent) => {
  event.waitUntil(
    handlePushEvent(event.data, {
      matchAll: (options) => self.clients.matchAll(options),
      showNotification: (title, options) => self.registration.showNotification(title, options),
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : DEFAULT_NOTIFICATION_URL;

  event.waitUntil(
    handleNotificationClick(targetUrl, {
      matchAll: (options) => self.clients.matchAll(options),
      openWindow: (url) => self.clients.openWindow(url),
    }),
  );
});
