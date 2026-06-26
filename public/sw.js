(() => {
  // lib/web-push/constants.ts
  var APP_NOTIFICATION_TITLE = "Corretor Studio";
  var NOTIFICATION_ICON_PATH = "/corretor-studio-icon.svg";
  var DEFAULT_NOTIFICATION_URL = "/";

  // lib/web-push/parse-push-payload.ts
  function parsePushPayload(data) {
    const fallback = {
      title: APP_NOTIFICATION_TITLE,
      body: "",
      url: DEFAULT_NOTIFICATION_URL
    };
    if (!data) {
      return fallback;
    }
    try {
      const parsed = data.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return fallback;
      }
      return {
        ...fallback,
        ...parsed
      };
    } catch {
      return {
        ...fallback,
        body: data.text()
      };
    }
  }
  function resolveNotificationOptions(payload) {
    return {
      body: payload.body || "",
      icon: NOTIFICATION_ICON_PATH,
      badge: NOTIFICATION_ICON_PATH,
      data: {
        url: payload.url || DEFAULT_NOTIFICATION_URL
      }
    };
  }

  // lib/web-push/service-worker-handlers.ts
  async function hasFocusedAppClient(matchAll) {
    const allClients = await matchAll({ type: "window", includeUncontrolled: true });
    return allClients.some((client) => client.focused);
  }
  async function handlePushEvent(data, deps) {
    const payload = parsePushPayload(data);
    const isSuppressed = await hasFocusedAppClient(deps.matchAll);
    if (isSuppressed) {
      return;
    }
    await deps.showNotification(payload.title || APP_NOTIFICATION_TITLE, resolveNotificationOptions(payload));
  }
  async function handleNotificationClick(targetUrl, deps) {
    const allClients = await deps.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      if (typeof client.focus === "function") {
        await client.focus();
        if (typeof client.navigate === "function") {
          await client.navigate(targetUrl);
        }
        return;
      }
    }
    await deps.openWindow(targetUrl);
  }

  // lib/web-push/service-worker.ts
  self.addEventListener("push", (event) => {
    event.waitUntil(handlePushEvent(event.data, {
      matchAll: (options) => self.clients.matchAll(options),
      showNotification: (title, options) => self.registration.showNotification(title, options)
    }));
  });
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data && typeof event.notification.data.url === "string" ? event.notification.data.url : DEFAULT_NOTIFICATION_URL;
    event.waitUntil(handleNotificationClick(targetUrl, {
      matchAll: (options) => self.clients.matchAll(options),
      openWindow: (url) => self.clients.openWindow(url)
    }));
  });
})();
