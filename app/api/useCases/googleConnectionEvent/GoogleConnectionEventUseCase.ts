import { GoogleConnectionEventType, GoogleConnectionFlow } from "@prisma/client";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { googleConnectionEventService } from "@/app/api/services/googleConnectionEvent/GoogleConnectionEventService";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import type {
  GoogleConnectionEventRecordInput,
  IGoogleConnectionEventService,
} from "@/app/api/services/googleConnectionEvent/IGoogleConnectionEventService";
import { Output } from "@/lib/output";

export { GoogleConnectionEventType, GoogleConnectionFlow };

export class GoogleConnectionEventUseCase {
  constructor(
    private readonly profileRepository: IProfileRepository = profileRepository,
    private readonly eventService: IGoogleConnectionEventService = googleConnectionEventService,
  ) {}

  async record(input: GoogleConnectionEventRecordInput): Promise<Output> {
    await this.eventService.record(input);
    return new Output(true, [], [], null);
  }

  async recordClientEvent(input: GoogleConnectionEventRecordInput): Promise<Output> {
    const profile = input.supabaseUserId
      ? await this.profileRepository.findBySupabaseId(input.supabaseUserId)
      : null;
    await this.eventService.record({
      ...input,
      profileId: profile?.id ?? input.profileId ?? null,
    });
    return new Output(true, [], [], null);
  }
}

export const googleConnectionEventUseCase = new GoogleConnectionEventUseCase();
