import type { WebPushConsentStatus } from "@prisma/client";
import type { WebPushConsentSource } from "@/lib/web-push/types";

export type UpsertWebPushConsentInput = {
  profileId: string;
  status: WebPushConsentStatus;
  consentVersion: string;
  source?: WebPushConsentSource | null;
};

export type WebPushConsentRecord = {
  status: WebPushConsentStatus;
  consentVersion: string;
  consentedAt: Date | null;
  declinedAt: Date | null;
  dismissedAt: Date | null;
  source: string | null;
};

export interface IProfileWebPushConsentRepository {
  findByProfileId(profileId: string): Promise<WebPushConsentRecord | null>;
  upsertConsent(input: UpsertWebPushConsentInput): Promise<void>;
}
