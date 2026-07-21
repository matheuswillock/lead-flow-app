import { APP_NOTIFICATION_TITLE } from "./constants";
import { parsePushPayload, resolveNotificationOptions } from "./parse-push-payload";
import type { WebPushPayload } from "./types";

type WindowClientLike = {
  focused: boolean;
  focus?: () => Promise<WindowClientLike>;
  navigate?: (url: string) => Promise<WindowClientLike | null>;
};

type MatchAllClients = (options: {
  type: "window";
  includeUncontrolled: boolean;
}) => Promise<readonly WindowClientLike[]>;

type ShowNotification = (
  title: string,
  options: NotificationOptions & { data: { url: string } },
) => Promise<void>;

export async function hasFocusedAppClient(matchAll: MatchAllClients): Promise<boolean> {
  const allClients = await matchAll({ type: "window", includeUncontrolled: true });
  return allClients.some((client) => client.focused);
}

export async function handlePushEvent(
  data: PushMessageData | null,
  deps: {
    matchAll: MatchAllClients;
    showNotification: ShowNotification;
  },
): Promise<void> {
  const payload = parsePushPayload(data);
  const isSuppressed = await hasFocusedAppClient(deps.matchAll);
  if (isSuppressed) {
    return;
  }

  await deps.showNotification(payload.title || APP_NOTIFICATION_TITLE, resolveNotificationOptions(payload));
}

export async function handleNotificationClick(
  targetUrl: string,
  deps: {
    matchAll: MatchAllClients;
    openWindow: (url: string) => Promise<WindowClientLike | null>;
  },
): Promise<void> {
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

export type { WebPushPayload };
