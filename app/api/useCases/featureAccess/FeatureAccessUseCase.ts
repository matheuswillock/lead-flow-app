import { Output } from "@/lib/output"
import type { IFeatureAccessService } from "@/app/api/services/featureAccess/IFeatureAccessService"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"

export interface ResolveFeatureAccessUseCaseInput {
  profileId: string
  managerId: string
}

export class FeatureAccessUseCase {
  constructor(private readonly service: IFeatureAccessService) {}

  async execute(input: ResolveFeatureAccessUseCaseInput): Promise<Output> {
    try {
      const { slugs, betaSlugs } = await this.service.resolveAllowedSlugs(input)
      return new Output(true, [], [], { slugs, betaSlugs })
    } catch (error) {
      console.error("[FeatureAccessUseCase][execute]", error)
      return new Output(false, [], ["Erro ao resolver acesso de funcionalidades"], null)
    }
  }
}

export const featureAccessUseCase = new FeatureAccessUseCase(featureAccessService)

