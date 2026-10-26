import type { IPublicFormBaseUrlResolver, PublicFormBaseUrlResolution } from "@/lib/public-forms/public-form-base-url-resolution"
import type { ITeamStudioDomainRepository } from "@/app/api/infra/data/repositories/teamStudioDomain/ITeamStudioDomainRepository"
import { teamStudioDomainRepository } from "@/app/api/infra/data/repositories/teamStudioDomain/TeamStudioDomainRepository"
import type { IPublicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"

function resolvePlatformBaseUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return null
  try {
    return new URL(appUrl).origin
  } catch {
    return null
  }
}

export class PublicStudioBaseUrlResolverService implements IPublicFormBaseUrlResolver {
  constructor(
    private readonly studioDomainRepository: ITeamStudioDomainRepository = teamStudioDomainRepository,
    private readonly formsRepository: IPublicFormsRepository = publicFormsRepository,
  ) {}

  async resolvePublicFormBaseUrl(teamId: string): Promise<PublicFormBaseUrlResolution> {
    const domain = await this.studioDomainRepository.findByTeamId(teamId)
    if (domain?.status === "verified") {
      return { baseUrl: `https://${domain.hostname}`, source: "team-domain" }
    }
    return { baseUrl: resolvePlatformBaseUrl(), source: "platform" }
  }

  async filterFormPublicIdsOwnedByTeam(teamId: string, publicIds: string[]): Promise<Set<string>> {
    if (publicIds.length === 0) return new Set()
    const owned = await this.formsRepository.findPublicIdsOwnedByTeam(teamId, publicIds)
    return new Set(owned.map((publicId) => publicId.toLowerCase()))
  }
}

export const publicStudioBaseUrlResolverService = new PublicStudioBaseUrlResolverService()
