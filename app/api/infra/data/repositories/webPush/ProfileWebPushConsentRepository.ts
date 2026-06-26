import { prisma } from "@/app/api/infra/data/prisma";
import type { WebPushConsentStatus } from "@prisma/client";
import type {
  IProfileWebPushConsentRepository,
  UpsertWebPushConsentInput,
  WebPushConsentRecord,
} from "./IProfileWebPushConsentRepository";

function resolveTimestampFields(status: WebPushConsentStatus, now: Date) {
  if (status === "accepted") {
    return { consentedAt: now, declinedAt: null, dismissedAt: null };
  }
  if (status === "declined") {
    return { consentedAt: null, declinedAt: now, dismissedAt: null };
  }
  return { consentedAt: null, declinedAt: null, dismissedAt: now };
}

export class ProfileWebPushConsentRepository implements IProfileWebPushConsentRepository {
  async findByProfileId(profileId: string): Promise<WebPushConsentRecord | null> {
    const consent = await prisma.profileWebPushConsent.findUnique({
      where: { profileId },
      select: {
        status: true,
        consentVersion: true,
        consentedAt: true,
        declinedAt: true,
        dismissedAt: true,
        source: true,
      },
    });

    return consent;
  }

  async upsertConsent(input: UpsertWebPushConsentInput): Promise<void> {
    const now = new Date();
    const timestamps = resolveTimestampFields(input.status, now);

    await prisma.profileWebPushConsent.upsert({
      where: { profileId: input.profileId },
      create: {
        profileId: input.profileId,
        status: input.status,
        consentVersion: input.consentVersion,
        source: input.source ?? null,
        ...timestamps,
      },
      update: {
        status: input.status,
        consentVersion: input.consentVersion,
        source: input.source ?? null,
        ...timestamps,
      },
    });
  }
}

export const profileWebPushConsentRepository = new ProfileWebPushConsentRepository();
