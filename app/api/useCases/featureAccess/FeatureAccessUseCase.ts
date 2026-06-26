import { Output } from "@/lib/output"
import { cacheLife, cacheTag } from "next/cache"
import { cacheTags } from "@/lib/cache/cacheTags"
import type { IFeatureAccessService } from "@/app/api/services/featureAccess/IFeatureAccessService"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"

export interface ResolveFeatureAccessUseCaseInput {
  profileId: string
  managerId: string
  activeTeamId?: string | null
}

async function resolveCachedFeatureAccess(
  profileId: string,
  managerId: string,
  activeTeamId: string | null
) {
  "use cache"
  cacheTag(cacheTags.featureAccess(profileId, activeTeamId))
  cacheTag(cacheTags.featureAccessProfile(profileId))
  cacheTag(cacheTags.featureAccessOwner(managerId))
  cacheTag(cacheTags.backofficeFeatures())
  cacheLife({ revalidate: 60 })

  return featureAccessService.resolveAllowedSlugs({ profileId, managerId, activeTeamId })
}

export class FeatureAccessUseCase {
  constructor(private readonly service: IFeatureAccessService) {}

  async execute(input: ResolveFeatureAccessUseCaseInput): Promise<Output> {
    try {
      const { slugs, betaSlugs, userRole } =
        this.service === featureAccessService
          ? await resolveCachedFeatureAccess(
              input.profileId,
              input.managerId,
              input.activeTeamId ?? null
            )
          : await this.service.resolveAllowedSlugs(input)
      return new Output(true, [], [], { slugs, betaSlugs, userRole })
    } catch (error) {
      console.error("[FeatureAccessUseCase][execute]", error)
      return new Output(false, [], ["Erro ao resolver acesso de funcionalidades"], null)
    }
  }
}

export const featureAccessUseCase = new FeatureAccessUseCase(featureAccessService)
