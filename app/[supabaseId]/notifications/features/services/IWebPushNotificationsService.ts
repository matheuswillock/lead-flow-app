import type { WebPushClientErrorPayload } from "@/lib/web-push/client-error-report";
import type { WebPushConsentSource } from "@/lib/web-push/types";

export type WebPushConsentStatus = "accepted" | "declined" | "dismissed";

export type WebPushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
  consentVersion?: string;
  source?: WebPushConsentSource;
};

export type WebPushConsentPayload = {
  status: Extract<WebPushConsentStatus, "declined" | "dismissed">;
  consentVersion: string;
  source: WebPushConsentSource;
};

export type WebPushConsentState = {
  status: WebPushConsentStatus | null;
  consentVersion: string | null;
  consentedAt: string | null;
  declinedAt: string | null;
  dismissedAt: string | null;
  source: string | null;
  shouldPrompt: boolean;
  currentConsentVersion: string;
};

export type RequestContext = {
  supabaseId: string;
  teamId: string;
};

export type EnableWebPushOptions = {
  source: WebPushConsentSource;
};

export interface IWebPushNotificationsService {
  getVapidPublicKey(): Promise<string>;
  getConsent(context: RequestContext): Promise<WebPushConsentState>;
  recordConsent(context: RequestContext, payload: WebPushConsentPayload): Promise<void>;
  subscribe(context: RequestContext, payload: WebPushSubscriptionPayload): Promise<void>;
  unsubscribe(context: RequestContext, endpoint: string): Promise<void>;
  reportClientError(context: RequestContext, payload: WebPushClientErrorPayload): Promise<void>;
}
