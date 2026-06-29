export type WebPushPayload = {
  title?: string;
  body?: string;
  url?: string;
  notificationId?: string | null;
};

export type WebPushConsentSource = "login_prompt" | "settings_sheet";
