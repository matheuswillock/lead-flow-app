import type { Prisma } from "@prisma/client";
import type { Output } from "@/lib/output";

export interface IBackofficeBotNotificationPreferenceUseCase {
  listPreferences(profileId: string): Promise<Output>;
  upsertPreference(
    profileId: string,
    type: string,
    enabled: boolean,
    quietHours?: Record<string, unknown>
  ): Promise<Output>;
  resolveProfileIdFromUserLink(userLinkId: string): Promise<
    | { profileId: string; error?: never; status?: never }
    | { profileId?: never; error: Output; status: number }
  >;
}
