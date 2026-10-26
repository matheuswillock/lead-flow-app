import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { teamApiResourceActivationRepository } from "@/app/api/infra/data/repositories/teamApiResource/TeamApiResourceActivationRepository";
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService";
import { ApiResourceActivationUseCase } from "./ApiResourceActivationUseCase";

export const apiResourceActivationUseCase = new ApiResourceActivationUseCase({
  activations: teamApiResourceActivationRepository,
  features: {
    hasIntegrationFeature: (teamId) =>
      featureAccessService.hasTeamFeatureAccess({ teamId, featureSlug: FEATURE_SLUGS.CONFIGURATION }),
  },
});
