import { normalizeHostname } from "@/lib/proxy/forms-host"
import type {
  IPublicFormBaseUrlResolver,
  PublicFormBaseUrlResolution,
} from "@/lib/public-forms/public-form-base-url-resolution"
import type { ITeamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"
import { teamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/TeamFormDomainRepository"
import type { IPublicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"

/**
 * Cache curto em memória por time: um disparo chama `dispatchBatch` várias
 * vezes (lotes de 100) e a resolução do domínio não muda no meio do disparo.
 */
const RESOLUTION_CACHE_TTL_MS = 30_000

type CacheEntry = { resolution: PublicFormBaseUrlResolution; expiresAt: number }

const resolutionCache = new Map<string, CacheEntry>()

/** Exposto para testes — o cache é module-level de propósito (ver TTL acima). */
export function clearPublicFormBaseUrlResolutionCache(): void {
  resolutionCache.clear()
}

function resolveFallbackEnvBaseUrl(): string | null {
  const hostname = normalizeHostname(
    process.env.PUBLIC_FORMS_FALLBACK_HOST?.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""),
  )
  return hostname ? `https://${hostname}` : null
}

function resolvePlatformBaseUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return null
  try {
    return new URL(appUrl).origin
  } catch {
    return null
  }
}

/**
 * Implementação concreta da porta `IPublicFormBaseUrlResolver` (ver
 * `lib/public-forms/public-form-base-url-resolution.ts`). Injetada no
 * `EmailCampaignDispatchService` pelo UseCase de campanha.
 */
export class PublicFormBaseUrlResolverService implements IPublicFormBaseUrlResolver {
  constructor(
    private readonly formDomainRepository: ITeamFormDomainRepository = teamFormDomainRepository,
    private readonly formsRepository: IPublicFormsRepository = publicFormsRepository,
  ) {}

  async resolvePublicFormBaseUrl(teamId: string): Promise<PublicFormBaseUrlResolution> {
    const cached = resolutionCache.get(teamId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.resolution
    }

    const resolution = await this.resolveUncached(teamId)
    resolutionCache.set(teamId, {
      resolution,
      expiresAt: Date.now() + RESOLUTION_CACHE_TTL_MS,
    })
    return resolution
  }

  async filterFormPublicIdsOwnedByTeam(
    teamId: string,
    publicIds: string[],
  ): Promise<Set<string>> {
    if (publicIds.length === 0) return new Set()

    const owned = await this.formsRepository.findPublicIdsOwnedByTeam(teamId, publicIds)
    return new Set(owned.map((publicId) => publicId.toLowerCase()))
  }

  private async resolveUncached(teamId: string): Promise<PublicFormBaseUrlResolution> {
    const domain = await this.formDomainRepository.findByTeamId(teamId)

    if (domain?.status === "verified") {
      return { baseUrl: `https://${domain.hostname}`, source: "team-domain" }
    }

    const fallbackBaseUrl = resolveFallbackEnvBaseUrl()
    if (fallbackBaseUrl) {
      return { baseUrl: fallbackBaseUrl, source: "fallback-env" }
    }

    return { baseUrl: resolvePlatformBaseUrl(), source: "platform" }
  }
}

export const publicFormBaseUrlResolverService = new PublicFormBaseUrlResolverService()
