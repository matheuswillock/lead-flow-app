import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { teamApiRequestLogRepository } from "@/app/api/infra/data/repositories/teamApiRequestLog/TeamApiRequestLogRepository";
import { teamApiResourceActivationRepository } from "@/app/api/infra/data/repositories/teamApiResource/TeamApiResourceActivationRepository";
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService";
import { ApiResourceActivationUseCase } from "./ApiResourceActivationUseCase";

export const apiResourceActivationUseCase = new ApiResourceActivationUseCase({
  activations: teamApiResourceActivationRepository,
  requestLogs: teamApiRequestLogRepository,
  features: {
    hasIntegrationFeature: (teamId) =>
      featureAccessService.hasTeamFeatureAccess({ teamId, featureSlug: FEATURE_SLUGS.CONFIGURATION }),
  },
});
