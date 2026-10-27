import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { consumeInboundRateLimit } from "@/lib/webhooks/inbound-rate-limit";
import { DEFAULT_TZ, resolveTimezone } from "@/lib/dates";
import { teamApiResourceActivationRepository } from "@/app/api/infra/data/repositories/teamApiResource/TeamApiResourceActivationRepository";
import { teamApiRequestLogRepository } from "@/app/api/infra/data/repositories/teamApiRequestLog/TeamApiRequestLogRepository";
import { teamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { calendarAvailabilityService } from "@/app/api/services/calendarAvailability/CalendarAvailabilityService";
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService";
import { inboundTeamAdapter } from "@/app/api/useCases/integrations/webhooks/inbound/InboundTeamAdapter";
import { ApiStudioAvailabilityUseCase } from "./ApiStudioAvailabilityUseCase";

/** Ligação do recurso "Horários disponíveis" aos serviços reais (SPEC 14, A-E3). */
export const apiStudioAvailabilityUseCase = new ApiStudioAvailabilityUseCase({
  activations: teamApiResourceActivationRepository,
  features: {
    hasIntegrationFeature: (teamId) =>
      featureAccessService.hasTeamFeatureAccess({ teamId, featureSlug: FEATURE_SLUGS.CONFIGURATION }),
  },
  teams: {
    async isAccountAllowed(teamId) {
      const team = await inboundTeamAdapter.getTeam(teamId);
      return team ? inboundTeamAdapter.isAccountAllowed(team) : false;
    },
    // Fuso do time = o do master (decidido na SPEC 14, DA4).
    async getTimezone(teamId) {
      const team = await inboundTeamAdapter.getTeam(teamId);
      const master = team ? await profileRepository.findWithGoogleConnectionById(team.managerProfileId) : null;
      return resolveTimezone(master?.timezone ?? DEFAULT_TZ);
    },
  },
  closers: { listActiveClosers: (teamId) => teamMembersRepository.findActiveClosers(teamId) },
  availability: {
    async getDay({ teamId, closerIds, date, timezone }) {
      const result = await calendarAvailabilityService.getAvailability({
        teamId,
        requestedCloserIds: closerIds,
        date,
        userTimezone: timezone,
      });
      return { durationMinutes: result.durationMinutes, perCloser: result.perCloser };
    },
  },
  requestLog: teamApiRequestLogRepository,
  limiter: { consume: consumeInboundRateLimit },
});
