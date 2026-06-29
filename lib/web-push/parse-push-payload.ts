import { APP_NOTIFICATION_TITLE, DEFAULT_NOTIFICATION_URL, NOTIFICATION_ICON_PATH } from "./constants";
import type { WebPushPayload } from "./types";

type PushMessageDataLike = {
  json(): unknown;
  text(): string;
};

export function parsePushPayload(data: PushMessageDataLike | null): WebPushPayload {
  const fallback: WebPushPayload = {
    title: APP_NOTIFICATION_TITLE,
    body: "",
    url: DEFAULT_NOTIFICATION_URL,
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
      ...(parsed as WebPushPayload),
    };
  } catch {
    return {
      ...fallback,
      body: data.text(),
    };
  }
}

export function resolveNotificationOptions(payload: WebPushPayload): NotificationOptions & {
  data: { url: string };
} {
  return {
    body: payload.body || "",
    icon: NOTIFICATION_ICON_PATH,
    badge: NOTIFICATION_ICON_PATH,
    data: {
      url: payload.url || DEFAULT_NOTIFICATION_URL,
    },
  };
}
