import { GoogleConnectionEventType, GoogleConnectionFlow } from "@prisma/client";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { googleConnectionEventService } from "@/app/api/services/googleConnectionEvent/GoogleConnectionEventService";

export { GoogleConnectionEventType, GoogleConnectionFlow };
export { googleConnectionEventService };

export class GoogleConnectionEventUseCase {
  async record(input: Parameters<typeof googleConnectionEventService.record>[0]): Promise<void> {
    await googleConnectionEventService.record(input);
  }

  async recordClientEvent(input: Parameters<typeof googleConnectionEventService.record>[0] & { supabaseUserId?: string | null }): Promise<void> {
    const profile = input.supabaseUserId ? await profileRepository.findBySupabaseId(input.supabaseUserId) : null;
    await googleConnectionEventService.record({ ...input, profileId: profile?.id ?? input.profileId ?? null });
  }
}

export const googleConnectionEventUseCase = new GoogleConnectionEventUseCase();
